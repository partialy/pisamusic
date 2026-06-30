package cn.partialy.pm.utils

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.MediaStore
import android.provider.OpenableColumns
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.utils.localdata.LocalMusicDbOpenHelper
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.security.MessageDigest
import javax.inject.Inject
import javax.inject.Singleton

data class LocalSongImportResult(
    val importedCount: Int,
    val skippedCount: Int,
)

@Singleton
class LocalSongStore @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val helper = LocalMusicDbOpenHelper(context)

    fun syncMediaStore() {
        val rows = queryMediaStoreRows()
        val now = System.currentTimeMillis()
        val seenIds = mutableSetOf<String>()
        val db = helper.writableDatabase
        db.beginTransaction()
        try {
            rows.forEach { row ->
                val id = mediaRecordId(row.mediaId)
                val existing = findDuplicateLocked(
                    contentUri = row.contentUri,
                    mediaStoreId = row.mediaId,
                    displayName = row.displayName,
                    size = row.size,
                    duration = row.duration,
                )
                val targetId = existing?.id ?: id
                seenIds.add(targetId)
                val createdAt = if (existing == null) now else null
                upsertRowLocked(
                    id = targetId,
                    origin = ORIGIN_MEDIA_STORE,
                    mediaStoreId = row.mediaId,
                    contentUri = row.contentUri,
                    filePath = row.filePath,
                    title = row.title,
                    artist = row.artist,
                    duration = row.duration,
                    size = row.size,
                    mimeType = row.mimeType,
                    displayName = row.displayName,
                    createdAt = createdAt,
                    updatedAt = now,
                )
            }
            markMissingMediaStoreRowsDeletedLocked(seenIds, now)
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun importSongs(uris: List<Uri>): LocalSongImportResult {
        var imported = 0
        var skipped = 0
        val now = System.currentTimeMillis()
        val db = helper.writableDatabase
        db.beginTransaction()
        try {
            uris.forEach { uri ->
                val meta = readImportMetadata(uri)
                val duplicate = findDuplicateLocked(
                    contentUri = meta.contentUri,
                    mediaStoreId = null,
                    displayName = meta.displayName,
                    size = meta.size,
                    duration = meta.duration,
                )
                if (duplicate != null && !duplicate.isDeleted) {
                    skipped++
                    return@forEach
                }
                val id = duplicate?.id ?: importedRecordId(meta.contentUri)
                upsertRowLocked(
                    id = id,
                    origin = ORIGIN_IMPORTED_URI,
                    mediaStoreId = null,
                    contentUri = meta.contentUri,
                    filePath = "",
                    title = meta.title,
                    artist = meta.artist,
                    duration = meta.duration,
                    size = meta.size,
                    mimeType = meta.mimeType,
                    displayName = meta.displayName,
                    createdAt = if (duplicate == null) now else null,
                    updatedAt = now,
                )
                imported++
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
        return LocalSongImportResult(imported, skipped)
    }

    fun querySongs(): List<SongInfo> =
        queryRows(includeDeleted = false)
            .distinctBy { it.playIdentity() }
            .map { it.toSongInfo() }

    fun queryRows(includeDeleted: Boolean = false): List<LocalMusicMediaRow> {
        val where = if (includeDeleted) null else "is_deleted = 0"
        val db = helper.readableDatabase
        val rows = mutableListOf<LocalMusicMediaRow>()
        db.query(
            TABLE,
            LOCAL_SONG_COLUMNS,
            where,
            null,
            null,
            null,
            "title COLLATE NOCASE ASC, display_name COLLATE NOCASE ASC",
        ).use { cursor ->
            while (cursor.moveToNext()) {
                rows.add(cursor.toLocalRow())
            }
        }
        return if (includeDeleted) rows else rows.distinctBy { it.playIdentity() }
    }

    fun queryRowsByIds(ids: Set<String>): List<LocalMusicMediaRow> {
        if (ids.isEmpty()) return emptyList()
        return queryRows(includeDeleted = true).filter { it.recordId in ids }
    }

    fun markDeleted(ids: Set<String>) {
        if (ids.isEmpty()) return
        val now = System.currentTimeMillis()
        val db = helper.writableDatabase
        db.beginTransaction()
        try {
            ids.forEach { id ->
                val values = ContentValues().apply {
                    put("is_deleted", 1)
                    put("updated_at", now)
                }
                db.update(TABLE, values, "id = ?", arrayOf(id))
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    private fun queryMediaStoreRows(): List<MediaStoreRow> {
        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.DATA,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.SIZE,
            MediaStore.Audio.Media.MIME_TYPE,
            MediaStore.Audio.Media.DISPLAY_NAME,
        )
        val rows = mutableListOf<MediaStoreRow>()
        context.contentResolver.query(
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
            projection,
            "${MediaStore.Audio.Media.IS_MUSIC} != 0",
            null,
            "${MediaStore.Audio.Media.TITLE} ASC",
        )?.use { cursor ->
            val idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
            val titleCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
            val artistCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
            val dataCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA)
            val durationCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
            val sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE)
            val mimeCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.MIME_TYPE)
            val displayCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME)
            while (cursor.moveToNext()) {
                val mediaId = cursor.getLong(idCol)
                val contentUri = LocalMusicMediaStore.contentUri(mediaId).toString()
                val displayName = cursor.getString(displayCol).orEmpty()
                val path = cursor.getString(dataCol).orEmpty()
                rows.add(
                    MediaStoreRow(
                        mediaId = mediaId,
                        contentUri = contentUri,
                        filePath = path,
                        title = cursor.getString(titleCol).orEmpty().ifBlank {
                            displayName.ifBlank { File(path).nameWithoutExtension }
                        },
                        artist = cursor.getString(artistCol).orEmpty(),
                        duration = cursor.getNullableLong(durationCol),
                        size = cursor.getNullableLong(sizeCol),
                        mimeType = cursor.getString(mimeCol).orEmpty(),
                        displayName = displayName,
                    ),
                )
            }
        }
        return rows
    }

    private fun readImportMetadata(uri: Uri): ImportedSongMetadata {
        val contentUri = uri.toString()
        var displayName = ""
        var size: Long? = null
        context.contentResolver.query(
            uri,
            arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE),
            null,
            null,
            null,
        )?.use { cursor ->
            if (cursor.moveToFirst()) {
                val nameCol = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                val sizeCol = cursor.getColumnIndex(OpenableColumns.SIZE)
                if (nameCol >= 0) displayName = cursor.getString(nameCol).orEmpty()
                if (sizeCol >= 0 && !cursor.isNull(sizeCol)) size = cursor.getLong(sizeCol)
            }
        }

        val mediaMeta = readRetrieverMetadata(uri)
        return ImportedSongMetadata(
            contentUri = contentUri,
            title = mediaMeta.title.ifBlank { displayName.substringBeforeLast('.', displayName) },
            artist = mediaMeta.artist,
            duration = mediaMeta.duration,
            size = size,
            mimeType = context.contentResolver.getType(uri).orEmpty(),
            displayName = displayName,
        )
    }

    private fun readRetrieverMetadata(uri: Uri): RetrieverMetadata {
        val retriever = MediaMetadataRetriever()
        return try {
            retriever.setDataSource(context, uri)
            RetrieverMetadata(
                title = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE).orEmpty(),
                artist = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST).orEmpty(),
                duration = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull(),
            )
        } catch (_: Exception) {
            RetrieverMetadata()
        } finally {
            runCatching { retriever.release() }
        }
    }

    private fun upsertRowLocked(
        id: String,
        origin: String,
        mediaStoreId: Long?,
        contentUri: String,
        filePath: String,
        title: String,
        artist: String,
        duration: Long?,
        size: Long?,
        mimeType: String,
        displayName: String,
        createdAt: Long?,
        updatedAt: Long,
    ) {
        val db = helper.writableDatabase
        val existingCreatedAt = if (createdAt == null) readCreatedAtLocked(id) else null
        val values = ContentValues().apply {
            put("id", id)
            put("origin", origin)
            if (mediaStoreId != null) put("media_store_id", mediaStoreId) else putNull("media_store_id")
            put("content_uri", contentUri)
            put("file_path", filePath)
            put("title", title)
            put("artist", artist)
            if (duration != null) put("duration", duration) else putNull("duration")
            if (size != null) put("size", size) else putNull("size")
            put("mime_type", mimeType)
            put("display_name", displayName)
            put("is_deleted", 0)
            put("created_at", createdAt ?: existingCreatedAt ?: updatedAt)
            put("updated_at", updatedAt)
        }
        db.insertWithOnConflict(TABLE, null, values, android.database.sqlite.SQLiteDatabase.CONFLICT_REPLACE)
    }

    private fun readCreatedAtLocked(id: String): Long? {
        helper.readableDatabase.query(
            TABLE,
            arrayOf("created_at"),
            "id = ?",
            arrayOf(id),
            null,
            null,
            null,
            "1",
        ).use { cursor ->
            return if (cursor.moveToFirst()) cursor.getLong(0) else null
        }
    }

    private fun markMissingMediaStoreRowsDeletedLocked(seenIds: Set<String>, now: Long) {
        val rows = queryRows(includeDeleted = false)
            .filter { it.origin == ORIGIN_MEDIA_STORE && it.recordId !in seenIds }
        rows.forEach { row ->
            val values = ContentValues().apply {
                put("is_deleted", 1)
                put("updated_at", now)
            }
            helper.writableDatabase.update(TABLE, values, "id = ?", arrayOf(row.recordId))
        }
    }

    private fun findDuplicateLocked(
        contentUri: String,
        mediaStoreId: Long?,
        displayName: String,
        size: Long?,
        duration: Long?,
    ): DuplicateRow? {
        findByWhere("content_uri = ?", arrayOf(contentUri))?.let { return it }
        if (mediaStoreId != null) {
            findByWhere("media_store_id = ?", arrayOf(mediaStoreId.toString()))?.let { return it }
        }
        if (displayName.isNotBlank() && size != null && duration != null) {
            findByWhere(
                "display_name = ? AND size = ? AND duration = ?",
                arrayOf(displayName, size.toString(), duration.toString()),
            )?.let { return it }
        }
        return null
    }

    private fun findByWhere(where: String, args: Array<String>): DuplicateRow? {
        helper.readableDatabase.query(
            TABLE,
            arrayOf("id", "is_deleted"),
            where,
            args,
            null,
            null,
            "is_deleted ASC, updated_at DESC",
            "1",
        ).use { cursor ->
            if (!cursor.moveToFirst()) return null
            return DuplicateRow(
                id = cursor.getString(0),
                isDeleted = cursor.getInt(1) == 1,
            )
        }
    }

    private fun LocalMusicMediaRow.toSongInfo(): SongInfo {
        val playId = when {
            origin == ORIGIN_IMPORTED_URI && contentUri.isNotBlank() -> contentUri
            filePath.isNotBlank() -> filePath
            contentUri.isNotBlank() -> contentUri
            else -> recordId
        }
        val coverBytes = readCoverBytes(this)
        return SongInfo(
            id = playId,
            type = SongType.LOCAL,
            name = title.ifBlank { displayName.ifBlank { File(playId).nameWithoutExtension } },
            artist = artist,
            coverUrl = "",
            embeddedCoverArt = coverBytes,
            duration = duration?.toInt(),
        )
    }

    private fun readCoverBytes(row: LocalMusicMediaRow): ByteArray? {
        if (row.contentUri.isNotBlank()) {
            AudioEmbeddedArtReader.readEmbeddedCoverBytes(context, Uri.parse(row.contentUri))?.let { return it }
        }
        if (row.filePath.isNotBlank()) {
            AudioEmbeddedArtReader.readEmbeddedCoverBytes(context, File(row.filePath))?.let { return it }
        }
        return null
    }

    private fun Cursor.toLocalRow(): LocalMusicMediaRow {
        val mediaId = getNullableLong(getColumnIndexOrThrow("media_store_id"))
        return LocalMusicMediaRow(
            recordId = getString(getColumnIndexOrThrow("id")),
            origin = getString(getColumnIndexOrThrow("origin")),
            mediaId = mediaId,
            contentUri = getString(getColumnIndexOrThrow("content_uri")).orEmpty(),
            filePath = getString(getColumnIndexOrThrow("file_path")).orEmpty(),
            title = getString(getColumnIndexOrThrow("title")).orEmpty(),
            artist = getString(getColumnIndexOrThrow("artist")).orEmpty(),
            displayName = getString(getColumnIndexOrThrow("display_name")).orEmpty(),
            duration = getNullableLong(getColumnIndexOrThrow("duration")),
            size = getNullableLong(getColumnIndexOrThrow("size")),
        )
    }

    private fun LocalMusicMediaRow.playIdentity(): String =
        contentUri.ifBlank { filePath.ifBlank { "${displayName}:${size}:${duration}" } }

    private fun Cursor.getNullableLong(column: Int): Long? =
        if (isNull(column)) null else getLong(column)

    private fun mediaRecordId(mediaId: Long): String = "media_store:$mediaId"

    private fun importedRecordId(contentUri: String): String =
        "imported_uri:${sha256(contentUri)}"

    private fun sha256(value: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(value.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }

    private data class MediaStoreRow(
        val mediaId: Long,
        val contentUri: String,
        val filePath: String,
        val title: String,
        val artist: String,
        val duration: Long?,
        val size: Long?,
        val mimeType: String,
        val displayName: String,
    )

    private data class ImportedSongMetadata(
        val contentUri: String,
        val title: String,
        val artist: String,
        val duration: Long?,
        val size: Long?,
        val mimeType: String,
        val displayName: String,
    )

    private data class RetrieverMetadata(
        val title: String = "",
        val artist: String = "",
        val duration: Long? = null,
    )

    private data class DuplicateRow(
        val id: String,
        val isDeleted: Boolean,
    )

    companion object {
        const val ORIGIN_MEDIA_STORE = "media_store"
        const val ORIGIN_IMPORTED_URI = "imported_uri"
        private const val TABLE = "local_songs"
        private val LOCAL_SONG_COLUMNS = arrayOf(
            "id",
            "origin",
            "media_store_id",
            "content_uri",
            "file_path",
            "title",
            "artist",
            "duration",
            "size",
            "mime_type",
            "display_name",
            "is_deleted",
            "created_at",
            "updated_at",
        )
    }
}
