package cn.partialy.pm.feedback

data class FeedbackHistoryItemDto(
    val id: String = "",
    val createdAt: String = "",
    val feedbackType: String = "other",
    val description: String = "",
    val contact: String? = null,
    val status: String = "pending",
    val processedAt: String? = null,
    val imageCount: Int = 0,
    val firstImageUrl: String? = null,
    val images: List<String> = emptyList(),
)

data class FeedbackHistoryPageDto(
    val list: List<FeedbackHistoryItemDto> = emptyList(),
    val total: Int = 0,
    val offset: Int = 0,
    val limit: Int = 20,
    val hasMore: Boolean = false,
)

data class FeedbackHistoryResponse(
    val code: Int = -1,
    val msg: String = "",
    val data: FeedbackHistoryPageDto? = null,
    val success: Boolean = false,
)

data class FeedbackDetailResponse(
    val code: Int = -1,
    val msg: String = "",
    val data: FeedbackHistoryItemDto? = null,
    val success: Boolean = false,
)
