package cn.partialy.pm.listen

internal data class QueuePointerResolution(
    val queueItemId: String? = null,
    val requestSnapshot: Boolean = false,
)

internal fun resolveQueuePointer(
    queue: ListenTogetherQueueState,
    song: ListenTogetherSong?,
    queueItemId: String?,
): QueuePointerResolution {
    if (!queueItemId.isNullOrBlank()) {
        val exact = queue.items.firstOrNull { it.queueItemId == queueItemId }
        return if (exact != null) {
            QueuePointerResolution(queueItemId = exact.queueItemId)
        } else {
            QueuePointerResolution(requestSnapshot = true)
        }
    }
    if (song == null) return QueuePointerResolution()
    val matches = queue.items.filter {
        it.song.source.equals(song.source, ignoreCase = true) && it.song.id == song.id
    }
    return when (matches.size) {
        0 -> QueuePointerResolution(requestSnapshot = true)
        1 -> QueuePointerResolution(queueItemId = matches.single().queueItemId)
        else -> QueuePointerResolution(requestSnapshot = true)
    }
}

internal fun shouldCompleteTransition(
    action: String,
    pendingTransitionId: String?,
    incomingTransitionId: String?,
): Boolean =
    action == "CHANGE_SONG" &&
        !pendingTransitionId.isNullOrBlank() &&
        pendingTransitionId == incomingTransitionId
