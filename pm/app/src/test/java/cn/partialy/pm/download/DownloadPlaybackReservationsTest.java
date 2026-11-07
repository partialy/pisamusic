package cn.partialy.pm.download;

import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import java.io.File;
import java.io.IOException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

public class DownloadPlaybackReservationsTest {
    @Rule public TemporaryFolder directory = new TemporaryFolder(createTempParent());

    private static File createTempParent() {
        File parent = new File(System.getProperty("user.dir"), "build/tmp/download-playback-reservations");
        if (!parent.isDirectory() && !parent.mkdirs() && !parent.isDirectory()) {
            throw new IllegalStateException("无法创建工程内测试临时目录：" + parent);
        }
        return parent;
    }

    @Test public void overlappingPreparationsKeepReservationUntilLastHandleCloses() throws Exception {
        File file = directory.newFile("song.mp3");
        DownloadPlaybackReservations.Handle first = DownloadPlaybackReservations.reserve(file);
        DownloadPlaybackReservations.Handle second = DownloadPlaybackReservations.reserve(new File(file.getParentFile(), "./song.mp3"));
        assertNotNull(first);
        assertNotNull(second);
        first.close();
        first.close();
        assertTrue(DownloadPlaybackReservations.isReserved(file));
        second.close();
        assertFalse(DownloadPlaybackReservations.isReserved(file));
    }

    @Test public void failedOrCancelledPreparationReleasesReservationInFinally() throws Exception {
        File file = directory.newFile("song.mp3");
        for (boolean cancel : new boolean[] { false, true }) {
            try (DownloadPlaybackReservations.Handle ignored = DownloadPlaybackReservations.reserve(file)) {
                assertTrue(DownloadPlaybackReservations.isReserved(file));
                if (cancel) throw new java.util.concurrent.CancellationException();
                throw new IOException("media preparation failed");
            } catch (IOException | java.util.concurrent.CancellationException expected) {
                assertFalse(DownloadPlaybackReservations.isReserved(file));
            }
        }
    }

    @Test public void reservationPreventsDeletionBeforeCurrentSongPublication() throws Exception {
        File file = directory.newFile("song.mp3");
        try (DownloadPlaybackReservations.Handle ignored = DownloadPlaybackReservations.reserve(file)) {
            synchronized (DownloadPlaybackReservations.lockFor(file)) {
                boolean busy = DownloadPlaybackReservations.isReserved(file);
                if (!busy) file.delete();
                assertTrue(busy);
                assertTrue(file.exists());
            }
        }
        synchronized (DownloadPlaybackReservations.lockFor(file)) {
            assertFalse(DownloadPlaybackReservations.isReserved(file));
            assertTrue(file.delete());
        }
    }

    @Test public void deletionWinningPathLockPreventsLaterPlaybackReservation() throws Exception {
        File file = directory.newFile("song.mp3");
        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch finished = new CountDownLatch(1);
        AtomicReference<Throwable> error = new AtomicReference<>();
        Thread preparation = new Thread(() -> {
            started.countDown();
            try { assertNull(DownloadPlaybackReservations.reserve(file)); }
            catch (Throwable failure) { error.set(failure); }
            finally { finished.countDown(); }
        });
        synchronized (DownloadPlaybackReservations.lockFor(file)) {
            preparation.start();
            assertTrue(started.await(5, TimeUnit.SECONDS));
            assertTrue(file.delete());
        }
        assertTrue(finished.await(5, TimeUnit.SECONDS));
        if (error.get() != null) throw new AssertionError(error.get());
    }

    @Test public void missingFilesAndRelativePathsCannotBeReserved() throws Exception {
        assertNull(DownloadPlaybackReservations.reserve(new File(directory.getRoot(), "missing.mp3")));
        assertNull(DownloadPlaybackReservations.reserve(new File("relative.mp3")));
    }
}
