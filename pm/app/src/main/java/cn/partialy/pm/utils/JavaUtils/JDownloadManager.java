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
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;

public class JDownloadManager {
    private static final ExecutorService executorService = Executors.newFixedThreadPool(3);
    private static final OkHttpClient client = new OkHttpClient();
    private static final ConcurrentHashMap<String, Object> fileLocks = new ConcurrentHashMap<>();

    public static String getDownloadPath(Context context) {
        return DownloadPathManager.INSTANCE.getDownloadPath(context);
    }

    public interface DownloadCallback {
        void onProgress(int progress, long downloadedBytes, long totalBytes);
        void onSuccess(String filePath);
        void onError(String error);
    }

    /**
     * @param coverUrl      封面地址；可为 null。嵌入时由 OkHttp 拉取字节。
     * @param embedMetadata false 时（如酷我）仅下载，不写标签。
     */
    public static void download(
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
            File downloadDir = new File(getDownloadPath(context));
            File targetFile = new File(downloadDir, fileName);
            String targetPath = targetFile.getAbsolutePath();
            Object fileLock = fileLocks.computeIfAbsent(targetPath, ignored -> new Object());
            synchronized (fileLock) {
                try {
                    downloadLocked(
                            context,
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
                }
            }
        });
    }

    private static void downloadLocked(
            Context context,
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
        try {
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
            try (Response response = client.newCall(request).execute()) {
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
                    try (Response coverResponse = client.newCall(coverRequest).execute()) {
                        if (coverResponse.isSuccessful() && coverResponse.body() != null) {
                            cover = coverResponse.body().bytes();
                        }
                    }
                } catch (Exception ignored) {
                }
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
            e.printStackTrace();
            new Handler(Looper.getMainLooper()).post(() ->
                    callback.onError(context.getString(R.string.download_error_detail, e.getMessage())));
        }
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
