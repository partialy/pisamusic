package cn.partialy.pm.utils.JavaUtils;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import cn.partialy.pm.utils.AudioMetadataEmbedder;
import cn.partialy.pm.utils.DownloadPathManager;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;

public class JDownloadManager {
    private static final ExecutorService executorService = Executors.newFixedThreadPool(3);
    private static final OkHttpClient client = new OkHttpClient();

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
            try {
                File downloadDir = new File(getDownloadPath(context));
                if (!downloadDir.exists()) {
                    downloadDir.mkdirs();
                }

                File file = new File(downloadDir, fileName);
                if (file.exists()) {
                    new Handler(Looper.getMainLooper()).post(() -> {
                        Toast.makeText(context, "文件已存在: " + file.getPath(), Toast.LENGTH_SHORT).show();
                        callback.onSuccess(file.getPath());
                    });
                    return;
                }

                Request request = new Request.Builder().url(url).build();
                Response response = client.newCall(request).execute();
                ResponseBody body = response.body();

                if (body == null) {
                    new Handler(Looper.getMainLooper()).post(() ->
                            callback.onError("下载失败：响应为空"));
                    return;
                }

                long contentLength = body.contentLength();
                InputStream inputStream = body.byteStream();
                FileOutputStream outputStream = new FileOutputStream(file);

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
                    long finalTotal = contentLength;

                    new Handler(Looper.getMainLooper()).post(() ->
                            callback.onProgress(progress, finalDownloaded, finalTotal));
                }

                outputStream.flush();
                outputStream.close();
                inputStream.close();
                response.close();

                if (!embedMetadata) {
                    new Handler(Looper.getMainLooper()).post(() -> {
                        Toast.makeText(context, "下载完成: " + file.getPath(), Toast.LENGTH_SHORT).show();
                        callback.onSuccess(file.getPath());
                    });
                    return;
                }

                String extension = getFileExtension(file.getName()).toLowerCase();
                if (!isSupportedFormat(extension)) {
                    new Handler(Looper.getMainLooper()).post(() -> {
                        Toast.makeText(context, "下载完成: " + file.getPath(), Toast.LENGTH_SHORT).show();
                        callback.onSuccess(file.getPath());
                    });
                    return;
                }

                byte[] cover = null;
                if (coverUrl != null && !coverUrl.isEmpty()) {
                    try {
                        Request coverReq = new Request.Builder().url(coverUrl).build();
                        Response coverResp = client.newCall(coverReq).execute();
                        if (coverResp.isSuccessful() && coverResp.body() != null) {
                            cover = coverResp.body().bytes();
                        }
                        coverResp.close();
                    } catch (Exception ignored) {
                    }
                }

                try {
                    AudioMetadataEmbedder.embed(file, title, artist, album, lyric, cover);
                    new Handler(Looper.getMainLooper()).post(() -> {
                        Toast.makeText(context, "下载完成: " + file.getPath(), Toast.LENGTH_SHORT).show();
                        callback.onSuccess(file.getPath());
                    });
                } catch (Exception e) {
                    e.printStackTrace();
                    new Handler(Looper.getMainLooper()).post(() ->
                            callback.onError("下载完成，但写入元数据失败: " + e.getMessage()));
                }

            } catch (Exception e) {
                e.printStackTrace();
                new Handler(Looper.getMainLooper()).post(() ->
                        callback.onError("下载失败：" + e.getMessage()));
            }
        });
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
