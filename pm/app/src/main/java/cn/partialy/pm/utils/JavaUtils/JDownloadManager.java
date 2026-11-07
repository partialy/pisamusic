package cn.partialy.pm.utils.JavaUtils;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import cn.partialy.pm.R;
import cn.partialy.pm.utils.AudioMetadataEmbedder;
import cn.partialy.pm.download.AudioMetadataVerifier;
import cn.partialy.pm.utils.DownloadPathManager;
import okhttp3.Call;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;

public class JDownloadManager {
    private static final ExecutorService executorService = Executors.newFixedThreadPool(3);
    private static final OkHttpClient client = new OkHttpClient();
    private static final ConcurrentHashMap<String, Object> fileLocks = new ConcurrentHashMap<>();
    private static final ConcurrentHashMap<String, Call> activeCalls = new ConcurrentHashMap<>();
    private static final java.util.Set<String> pausedTaskIds = ConcurrentHashMap.newKeySet();
    private static final java.util.Set<String> processingTaskIds = ConcurrentHashMap.newKeySet();
    private static final ConcurrentHashMap<String, ResumeInfo> resumeInfo = new ConcurrentHashMap<>();
    private static final java.util.Set<String> cancelledTaskIds = ConcurrentHashMap.newKeySet();

    public static String getDownloadPath(Context context) {
        return DownloadPathManager.INSTANCE.getDownloadPath(context);
    }

    public interface DownloadCallback {
        void onProgress(int progress, long downloadedBytes, long totalBytes);
        void onSuccess(String filePath, String metadataStatus, String metadataWarning);
        void onError(String error);
        void onCancelled();
        default void onPaused(long bytes) {}
        default boolean onProcessing() { return true; }
        default void onCheckpoint(String etag, String modified, long total, long fileModified) {}
    }

    public static class ResumeInfo {
        public final String etag, modified;
        public final long total, bytes, fileModified;
        public ResumeInfo(String etag, String modified, long total, long bytes, long fileModified) {
            this.etag = etag; this.modified = modified; this.total = total; this.bytes = bytes; this.fileModified = fileModified;
        }
    }
    public static void setResumeInfo(String id, ResumeInfo info) { resumeInfo.put(id, info); }
    public static void pause(String id) {
        if (processingTaskIds.contains(id)) return;
        pausedTaskIds.add(id);
        Call call = activeCalls.get(id);
        if (call != null) call.cancel();
    }

    /**
     * @param coverUrl      封面地址；可为 null。嵌入时由 OkHttp 拉取字节。
     * @param embedMetadata false 时（如酷我）仅下载，不写标签。
     */
    public static void download(
            String taskId,
            Context context,
            String url,
            String fileName,
            String targetDirectory,
            String coverUrl,
            boolean embedMetadata,
            String title,
            String artist,
            String album,
            String lyric,
            DownloadCallback callback
    ) {
        executorService.execute(() -> {
            if (isCancelled(taskId)) {
                finishCancelled(taskId, callback);
                return;
            }
            File downloadDir = new File(targetDirectory);
            File targetFile = new File(downloadDir, fileName);
            String targetPath = targetFile.getAbsolutePath();
            Object fileLock = cn.partialy.pm.download.DownloadFileLocks.lockFor(targetFile);
            synchronized (fileLock) {
                try {
                    downloadLocked(
                            context,
                            taskId,
                            url,
                            fileName,
                            coverUrl,
                            embedMetadata,
                            title,
                            artist,
                            album,
                            lyric,
                            downloadDir,
                            targetFile,
                            callback
                    );
                } finally {
                    processingTaskIds.remove(taskId);
                    pausedTaskIds.remove(taskId);
                    resumeInfo.remove(taskId);
                    activeCalls.remove(taskId);
                    cancelledTaskIds.remove(taskId);
                }
            }
        });
    }

    public static void cancel(String taskId) {
        if (processingTaskIds.contains(taskId)) return;
        cancelledTaskIds.add(taskId);
        Call call = activeCalls.get(taskId);
        if (call != null) {
            call.cancel();
        }
    }

    private static void downloadLocked(
            Context context,
            String taskId,
            String url,
            String fileName,
            String coverUrl,
            boolean embedMetadata,
            String title,
            String artist,
            String album,
            String lyric,
            File downloadDir,
            File file,
            DownloadCallback callback
    ) {
        File partialFile = new File(downloadDir, fileName + ".part");
        File stagedFile = new File(downloadDir, fileName + ".stage." + getFileExtension(fileName));
        boolean fileAlreadyExisted = file.exists();
        try {
            if (isCancelled(taskId)) {
                finishCancelled(taskId, callback);
                return;
            }
            if (!downloadDir.exists()) {
                downloadDir.mkdirs();
            }
            if (file.exists()) {
                new Handler(Looper.getMainLooper()).post(() -> {
                    callback.onSuccess(file.getPath(), "SKIPPED", null);
                });
                return;
            }

            transfer(taskId, url, partialFile, callback);
            if (isCancelled(taskId)) throw new DownloadCancelledException();
            if (pausedTaskIds.contains(taskId)) throw new DownloadPausedException();
            // 同步确认用户意图之后，处理阶段不可再暂停或取消。
            if (!callback.onProcessing()) {
                if (isCancelled(taskId)) throw new DownloadCancelledException();
                throw new DownloadPausedException();
            }
            processingTaskIds.add(taskId);
            // 用真实音频扩展名命名临时文件，供 jaudiotagger 按格式识别。
            Files.move(partialFile.toPath(), stagedFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
            if (!AudioMetadataVerifier.isReadable(stagedFile)) throw new java.io.IOException("音频完整性校验失败");
            String metadataStatus = "SKIPPED";
            String metadataWarning = null;
            if (embedMetadata && isSupportedFormat(getFileExtension(file.getName()).toLowerCase())) {
                if (!AudioMetadataVerifier.isReadable(stagedFile)) {
                    metadataWarning = "此格式暂不支持内嵌标签";
                } else {
                byte[] cover = null;
                if (coverUrl != null && !coverUrl.isEmpty()) {
                    try {
                        Request coverRequest = new Request.Builder().url(coverUrl).build();
                        Call coverCall = client.newCall(coverRequest);
                        activeCalls.put(taskId, coverCall);
                        try (Response coverResponse = coverCall.execute()) {
                            if (coverResponse.isSuccessful() && coverResponse.body() != null) {
                                cover = coverResponse.body().bytes();
                            }
                        } finally {
                            activeCalls.remove(taskId, coverCall);
                        }
                    } catch (Exception ignored) {
                        // 封面网络失败不能让音频下载失败。
                    }
                }
                if (isCancelled(taskId)) throw new DownloadCancelledException();
                boolean coverMissing = coverUrl != null && !coverUrl.isEmpty() && (cover == null || cover.length == 0);
                try {
                    if ((title == null || title.isBlank()) && (artist == null || artist.isBlank()) &&
                        (album == null || album.isBlank()) && (lyric == null || lyric.isBlank()) &&
                        (cover == null || cover.length == 0)) {
                        metadataStatus = coverMissing ? "PARTIAL" : "SKIPPED";
                        metadataWarning = coverMissing ? "封面获取失败" : null;
                    } else {
                    AudioMetadataEmbedder.embed(stagedFile, title, artist, album, lyric, cover);
                    if (!AudioMetadataVerifier.verify(stagedFile, title, artist, album, lyric, cover != null && cover.length > 0)) {
                        throw new IllegalStateException("元数据写入后校验失败");
                    }
                    metadataStatus = coverMissing ? "PARTIAL" : "SUCCESS";
                    metadataWarning = coverMissing ? "封面获取失败" : null;
                    }
                } catch (Exception error) {
                    // 音频本身仍有效时降级为“已下载，附加信息失败”。
                    if (!AudioMetadataVerifier.isReadable(stagedFile)) {
                        throw new IllegalStateException("标签处理后音频不可读取", error);
                    }
                    metadataStatus = "FAILED";
                    metadataWarning = "歌曲标签处理失败：" + (error.getMessage() == null ? "未知错误" : error.getMessage());
                }
                }
            }
            if (isCancelled(taskId)) throw new DownloadCancelledException();
            Files.move(stagedFile.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING);
            final String outcome = metadataStatus;
            final String warning = metadataWarning;
            new Handler(Looper.getMainLooper()).post(() -> callback.onSuccess(file.getPath(), outcome, warning));
        } catch (Exception e) {
            if (pausedTaskIds.contains(taskId) || e instanceof DownloadPausedException) {
                callback.onPaused(partialFile.length());
                return;
            }
            if (stagedFile.exists()) stagedFile.delete();
            if (isCancelled(taskId) || e instanceof DownloadCancelledException) {
                if (partialFile.exists()) partialFile.delete();
                if (!fileAlreadyExisted && file.exists()) {
                    file.delete();
                }
                finishCancelled(taskId, callback);
                return;
            }
            new Handler(Looper.getMainLooper()).post(() ->
                    callback.onError(context.getString(R.string.download_error_detail, e.getMessage())));
        }
    }

    private static final class DownloadPausedException extends Exception {}

    private static void transfer(String id, String url, File part, DownloadCallback callback) throws Exception {
        ResumeInfo saved = resumeInfo.get(id);
        long offset = part.isFile() ? part.length() : 0;
        boolean strong = saved != null && saved.etag != null && !saved.etag.startsWith("W/");
        boolean canResume = offset > 0 && saved != null && saved.bytes == offset && saved.fileModified == part.lastModified()
                && saved.total >= offset && (strong || saved.modified != null);
        for (int attempt = 0; attempt < 2; attempt++) {
            if (isCancelled(id)) throw new DownloadCancelledException();
            if (pausedTaskIds.contains(id)) throw new DownloadPausedException();
            Request.Builder builder = new Request.Builder().url(url).header("Accept-Encoding", "identity");
            if (canResume) builder.header("Range", "bytes=" + offset + "-").header("If-Range", strong ? saved.etag : saved.modified);
            Call call = client.newCall(builder.build());
            activeCalls.put(id, call);
            try (Response response = call.execute()) {
                if (response.code() == 416 && canResume) {
                    // 长度相等不足以证明音频完整，受控重启完整请求。
                    canResume = false;
                    continue;
                }
                if (!response.isSuccessful()) throw new java.io.IOException("HTTP " + response.code());
                String encoding = response.header("Content-Encoding");
                if (encoding != null && !encoding.equalsIgnoreCase("identity")) throw new java.io.IOException("不支持的内容编码");
                ResponseBody body = response.body();
                if (body == null) throw new java.io.IOException("下载响应为空");
                boolean append = response.code() == 206;
                long total = body.contentLength();
                if (append) {
                    java.util.regex.Matcher range = java.util.regex.Pattern.compile("bytes (\\d+)-(\\d+)/(\\d+)").matcher(String.valueOf(response.header("Content-Range")));
                    if (!canResume || !range.matches()) throw new java.io.IOException("续传范围无效");
                    long start = Long.parseLong(range.group(1)), end = Long.parseLong(range.group(2));
                    total = Long.parseLong(range.group(3));
                    boolean validatorMatches = strong ? saved.etag.equals(response.header("ETag")) : saved.modified.equals(response.header("Last-Modified"));
                    if (start != offset || end < start || end >= total || total != saved.total || !validatorMatches
                            || (body.contentLength() >= 0 && body.contentLength() != end - start + 1)) throw new java.io.IOException("续传资源校验失败");
                } else if (response.code() != 200) throw new java.io.IOException("下载状态无效");
                String etag = response.header("ETag"), modified = response.header("Last-Modified");
                long count = append ? offset : 0;
                try (InputStream input = body.byteStream(); FileOutputStream output = new FileOutputStream(part, append)) {
                    callback.onCheckpoint(etag, modified, total, part.lastModified());
                    byte[] buffer = new byte[32768];
                    int size;
                    while ((size = input.read(buffer)) != -1) {
                        if (isCancelled(id)) throw new DownloadCancelledException();
                        if (pausedTaskIds.contains(id)) throw new DownloadPausedException();
                        output.write(buffer, 0, size);
                        count += size;
                        if (total >= 0 && count > total) throw new java.io.IOException("下载长度超出预期");
                        callback.onProgress(total > 0 ? (int) Math.min(100, count * 100 / total) : 0, count, Math.max(0, total));
                    }
                    output.flush();
                    output.getFD().sync();
                    if (total >= 0 && count != total) throw new java.io.IOException("下载未完成");
                } finally {
                    callback.onCheckpoint(etag, modified, total, part.lastModified());
                }
                return;
            } finally {
                activeCalls.remove(id, call);
            }
        }
        throw new java.io.IOException("续传重试失败");
    }

    private static boolean isCancelled(String taskId) {
        return cancelledTaskIds.contains(taskId);
    }

    private static void finishCancelled(String taskId, DownloadCallback callback) {
        cancelledTaskIds.remove(taskId);
        activeCalls.remove(taskId);
        new Handler(Looper.getMainLooper()).post(callback::onCancelled);
    }

    private static final class DownloadCancelledException extends Exception {
    }

    private static boolean isSupportedFormat(String extension) {
        return extension.equals("mp3") ||
                extension.equals("flac") ||
                extension.equals("ogg") ||
                extension.equals("wav") ||
                extension.equals("wma") ||
                extension.equals("m4a") ||
                extension.equals("aiff");
    }

    private static String getFileExtension(String fileName) {
        int i = fileName.lastIndexOf('.');
        if (i > 0) {
            return fileName.substring(i + 1);
        }
        return "";
    }
}
