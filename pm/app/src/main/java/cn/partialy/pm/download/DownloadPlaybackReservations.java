package cn.partialy.pm.download;

import java.io.Closeable;
import java.io.File;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;

/** canonical 路径互斥和短期播放预留；Handle 可跨异步准备阶段，不跨挂起持有监视器。 */
public final class DownloadPlaybackReservations {
    private DownloadPlaybackReservations() {}
    private static final ConcurrentHashMap<String, Object> LOCKS = new ConcurrentHashMap<>();
    private static final ConcurrentHashMap<String, Integer> RESERVATIONS = new ConcurrentHashMap<>();

    public static Object lockFor(File file) throws IOException {
        return LOCKS.computeIfAbsent(file.getCanonicalPath(), ignored -> new Object());
    }

    public static Handle reserve(File file) throws IOException {
        String path = file.getCanonicalPath();
        Object lock = lockFor(file);
        synchronized (lock) {
            if (!file.isAbsolute() || !file.isFile() || !file.canRead()) return null;
            RESERVATIONS.merge(path, 1, Integer::sum);
            return new Handle(path, lock);
        }
    }

    public static boolean isReserved(File file) throws IOException {
        synchronized (lockFor(file)) {
            return RESERVATIONS.getOrDefault(file.getCanonicalPath(), 0) > 0;
        }
    }

    public static final class Handle implements Closeable {
        private final String path;
        private final Object lock;
        private boolean closed;
        private Handle(String path, Object lock) { this.path = path; this.lock = lock; }
        @Override public void close() {
            synchronized (lock) {
                if (closed) return;
                closed = true;
                int count = RESERVATIONS.getOrDefault(path, 0);
                if (count <= 1) RESERVATIONS.remove(path);
                else RESERVATIONS.put(path, count - 1);
            }
        }
    }
}
