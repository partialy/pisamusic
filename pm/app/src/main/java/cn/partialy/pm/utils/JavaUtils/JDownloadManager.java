package cn.partialy.pm.utils.JavaUtils;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;

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
    private static final java.util.Set<String> cancelledTaskIds = ConcurrentHashMap.newKeySet();

    public static String getDownloadPath(Context context) {
        return DownloadPathManager.INSTANCE.getDownloadPath(context);
    }

    public interface DownloadCallback {
        void onProgress(int progress, long downloadedBytes, long totalBytes);
        void onSuccess(String filePath);
        void onError(String error);
        void onCancelled();
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
            File downloadDir = new File(getDownloadPath(context));
            File targetFile = new File(downloadDir, fileName);
            String targetPath = targetFile.getAbsolutePath();
            Object fileLock = fileLocks.computeIfAbsent(targetPath, ignored -> new Object());
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
                    fileLocks.remove(targetPath, fileLock);
                    activeCalls.remove(taskId);
                    cancelledTaskIds.remove(taskId);
                }
            }
        });
    }

    public static void cancel(String taskId) {
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
                    Toast.makeText(
                            context,
                            context.getString(R.string.download_file_exists, file.getPath()),
                            Toast.LENGTH_SHORT
                    ).show();
                    callback.onSuccess(file.getPath());
                });
                return;
            }

            Request request = new Request.Builder().url(url).build();
            Call audioCall = client.newCall(request);
            activeCalls.put(taskId, audioCall);
            try (Response response = audioCall.execute()) {
                if (!response.isSuccessful()) {
                    int code = response.code();
                    new Handler(Looper.getMainLooper()).post(() -> callback.onError("HTTP " + code));
                    return;
                }
                ResponseBody body = response.body();
                if (body == null) {
                    new Handler(Looper.getMainLooper()).post(() ->
                            callback.onError(context.getString(R.string.download_empty_response)));
                    return;
                }

                if (partialFile.exists()) {
                    partialFile.delete();
                }
                long contentLength = body.contentLength();
                try (
                        InputStream inputStream = body.byteStream();
                        FileOutputStream outputStream = new FileOutputStream(partialFile)
                ) {
                    byte[] buffer = new byte[4096];
                    long downloadedLength = 0;
                    int len;
                    while ((len = inputStream.read(buffer)) != -1) {
                        if (isCancelled(taskId)) {
                            throw new DownloadCancelledException();
                        }
                        outputStream.write(buffer, 0, len);
                        downloadedLength += len;

                        int progress = contentLength > 0
                                ? (int) ((downloadedLength * 100L) / contentLength)
                                : 0;
                        long finalDownloaded = downloadedLength;
                        new Handler(Looper.getMainLooper()).post(() ->
                                callback.onProgress(progress, finalDownloaded, contentLength));
                    }
                    outputStream.flush();
                }
            } finally {
                activeCalls.remove(taskId, audioCall);
            }

            if (isCancelled(taskId)) {
                throw new DownloadCancelledException();
            }
            Files.move(partialFile.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING);
            if (!embedMetadata || !isSupportedFormat(getFileExtension(file.getName()).toLowerCase())) {
                new Handler(Looper.getMainLooper()).post(() -> callback.onSuccess(file.getPath()));
                return;
            }

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
                }
            }

            if (isCancelled(taskId)) {
                throw new DownloadCancelledException();
            }
            try {
                AudioMetadataEmbedder.embed(file, title, artist, album, lyric, cover);
                new Handler(Looper.getMainLooper()).post(() -> callback.onSuccess(file.getPath()));
            } catch (Exception error) {
                error.printStackTrace();
                new Handler(Looper.getMainLooper()).post(() -> callback.onError(context.getString(
                        R.string.download_metadata_write_failed,
                        error.getMessage()
                )));
            }
        } catch (Exception e) {
            if (partialFile.exists()) {
                partialFile.delete();
            }
            if (isCancelled(taskId) || e instanceof DownloadCancelledException) {
                if (!fileAlreadyExisted && file.exists()) {
                    file.delete();
                }
                finishCancelled(taskId, callback);
                return;
            }
            e.printStackTrace();
            new Handler(Looper.getMainLooper()).post(() ->
                    callback.onError(context.getString(R.string.download_error_detail, e.getMessage())));
        }
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
