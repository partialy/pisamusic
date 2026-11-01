package cn.partialy.pm.utils.playlistUtil

import android.database.sqlite.SQLiteDatabase
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.sync.SyncOutboxStore
import cn.partialy.pm.utils.localdata.LocalMusicDbOpenHelper
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class LocalPlaylistStorageTest {
    private val context get() = InstrumentationRegistry.getInstrumentation().context

    @Test fun migrationPreservesPayloadAndAllowsSameIdAcrossSources() {
        SQLiteDatabase.create(null).use { db ->
            val helper = LocalMusicDbOpenHelper(context)
            helper.onCreate(db)
            // 模拟 V12 唯一键；不依赖列的物理排列顺序。
            db.execSQL("DROP TABLE local_playlist_songs")
            db.execSQL("CREATE TABLE local_playlist_songs (playlist_id TEXT, song_id TEXT, song_type TEXT, name TEXT, artist TEXT, cover_url TEXT, album TEXT, lyric TEXT, duration INTEGER, sort_order INTEGER, updated_at INTEGER, source TEXT, url_param TEXT, singer TEXT, cover TEXT, payload_json TEXT, PRIMARY KEY(playlist_id,song_id))")
            db.execSQL("INSERT INTO local_playlist_songs VALUES ('p','same','KG','song','artist','cover',NULL,NULL,123,7,99,'kg','same','artist','cover','{\"playable\":false}')")
            helper.onUpgrade(db, 12, 13)
            db.rawQuery("SELECT sort_order,payload_json,duration FROM local_playlist_songs", null).use {
                assertTrue(it.moveToFirst())
                assertEquals(7, it.getInt(0))
                assertEquals("{\"playable\":false}", it.getString(1))
                assertEquals(123, it.getInt(2))
            }
            db.execSQL("INSERT INTO local_playlist_songs SELECT playlist_id,song_id,source,url_param,'WY',name,singer,artist,cover,cover_url,album,lyric,duration,payload_json,8,updated_at FROM local_playlist_songs WHERE song_type='KG'")
            db.rawQuery("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_local_playlist_songs_order'", null).use {
                assertTrue(it.moveToFirst())
            }
            db.rawQuery("SELECT COUNT(*) FROM local_playlist_songs", null).use {
                it.moveToFirst(); assertEquals(2, it.getInt(0))
            }
        }
    }

    @Test fun failedOutboxInsertRollsBackPlaylistAndSongs() {
        val helper = LocalMusicDbOpenHelper(context)
        val db = helper.writableDatabase
        val id = UUID.randomUUID().toString()
        val store = LocalPlaylistDbStore(context)
        db.execSQL("CREATE TRIGGER reject_playlist_outbox BEFORE INSERT ON sync_outbox WHEN NEW.item_key = '$id|wy:second' BEGIN SELECT RAISE(ABORT, 'test failure'); END")
        try {
            try {
                store.createPlaylistWithSongs(CollectedPlaylist(CollectedPlaylistType.LOCAL, id, "rollback"),
                    listOf(
                        SongInfo(id="first", type=SongType.KG, name="test", artist="artist", coverUrl=""),
                        SongInfo(id="second", type=SongType.WY, name="test", artist="artist", coverUrl=""),
                    ), SyncOutboxStore(context))
                fail("Expected outbox failure")
            } catch (expected: android.database.SQLException) {
                assertFalse(store.playlistExists(id))
                assertTrue(store.getSongs(id).isEmpty())
                db.rawQuery("SELECT COUNT(*) FROM sync_outbox WHERE item_key = ? OR item_key LIKE ?", arrayOf("local:$id", "$id|%")).use {
                    it.moveToFirst(); assertEquals(0, it.getInt(0))
                }
            }
        } finally {
            db.execSQL("DROP TRIGGER reject_playlist_outbox")
            helper.close()
        }
    }
    @Test fun exactRemovalSurvivesReloadWithoutRestoringStaleMirror() {
        val manager = PlaylistCollectionManager(context)
        val kg = SongInfo("same", SongType.KG, "kg", "artist", "")
        val wy = SongInfo("same", SongType.WY, "wy", "artist", "")
        val id = manager.createLocalPlaylistWithSongs("identity", listOf(kg, wy))
        try {
            // 固定旧快照后删除，模拟镜像未及时写入的进程退出。
            manager.syncLegacyMirrorNow()
            assertTrue(manager.removeSongsFromLocalPlaylistByIdentity(id, listOf(kg)))
            manager.reload()
            val reopened = PlaylistCollectionManager(context)
            assertEquals(listOf(SongType.WY), reopened.getLocalPlaylistSongs(id).map { it.type })
            // 显式备份恢复仍能重新合并被删除的来源，保留另一来源同 ID。
            val restored = reopened.addSongsToLocalPlaylistWithResult(id, listOf(kg))
            assertEquals(1, restored.added.size)
            reopened.reload()
            assertEquals(setOf(SongType.KG, SongType.WY), reopened.getLocalPlaylistSongs(id).map { it.type }.toSet())
        } finally {
            manager.removePlaylist(CollectedPlaylistType.LOCAL, id)
        }
    }

}
