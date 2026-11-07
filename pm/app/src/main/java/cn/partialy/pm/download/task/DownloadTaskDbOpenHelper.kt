package cn.partialy.pm.download.task

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

internal class DownloadTaskDbOpenHelper(context: Context) :
    SQLiteOpenHelper(context.applicationContext, DB_NAME, null, DB_VERSION) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS download_tasks (
                id TEXT PRIMARY KEY,
                song_id TEXT NOT NULL,
                source TEXT NOT NULL,
                title TEXT NOT NULL,
                artist TEXT NOT NULL DEFAULT '',
                album TEXT,
                cover_url TEXT NOT NULL DEFAULT '',
                quality_key TEXT NOT NULL,
                file_name TEXT,
                target_path TEXT,
                sidecar_paths_json TEXT NOT NULL DEFAULT '[]',
                status TEXT NOT NULL,
                progress INTEGER NOT NULL DEFAULT 0,
                downloaded_bytes INTEGER NOT NULL DEFAULT 0,
                total_bytes INTEGER NOT NULL DEFAULT 0,
                error_message TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                completed_at INTEGER,
                metadata_status TEXT NOT NULL DEFAULT 'UNKNOWN',
                metadata_warning TEXT,
                attempt_generation INTEGER NOT NULL DEFAULT 0,
                resume_etag TEXT, resume_last_modified TEXT, resume_total_bytes INTEGER,
                resume_quality_key TEXT, resume_resource_identity TEXT, resume_file_modified INTEGER, pause_reason TEXT
            )
            """.trimIndent(),
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_download_tasks_updated ON download_tasks(updated_at DESC)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_download_tasks_status ON download_tasks(status, updated_at DESC)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) {
            db.execSQL("ALTER TABLE download_tasks ADD COLUMN metadata_status TEXT NOT NULL DEFAULT 'UNKNOWN'")
            db.execSQL("ALTER TABLE download_tasks ADD COLUMN metadata_warning TEXT")
        }
        if (oldVersion < 3) {
            db.execSQL("ALTER TABLE download_tasks ADD COLUMN attempt_generation INTEGER NOT NULL DEFAULT 0")
            listOf("resume_etag TEXT", "resume_last_modified TEXT", "resume_total_bytes INTEGER", "resume_quality_key TEXT", "resume_resource_identity TEXT", "resume_file_modified INTEGER", "pause_reason TEXT").forEach {
                db.execSQL("ALTER TABLE download_tasks ADD COLUMN $it")
            }
        }
    }

    companion object {
        private const val DB_NAME = "pm_download_tasks.db"
        private const val DB_VERSION = 3
    }
}
