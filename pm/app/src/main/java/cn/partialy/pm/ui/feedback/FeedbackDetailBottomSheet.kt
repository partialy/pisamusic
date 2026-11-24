package cn.partialy.pm.ui.feedback

import android.app.Activity
import android.app.Dialog
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import androidx.core.content.ContextCompat
import cn.partialy.pm.R
import cn.partialy.pm.databinding.BottomSheetFeedbackDetailBinding
import cn.partialy.pm.databinding.DialogImagePreviewBinding
import cn.partialy.pm.feedback.FeedbackFormatters
import cn.partialy.pm.feedback.FeedbackHistoryItemDto
import cn.partialy.pm.ui.message.PmMessage
import coil.load
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.imageview.ShapeableImageView
import com.google.android.material.shape.ShapeAppearanceModel

object FeedbackDetailBottomSheet {

    fun show(
        activity: Activity,
        item: FeedbackHistoryItemDto,
        resolveImageUrl: (String?) -> String?,
    ): BottomSheetDialog {
        val inflater = LayoutInflater.from(activity)
        val binding = BottomSheetFeedbackDetailBinding.inflate(inflater)
        val sheet = BottomSheetDialog(activity, R.style.ThemeOverlay_Pm_BottomSheetDialog)
        sheet.setContentView(binding.root)
        sheet.behavior.skipCollapsed = true
        sheet.behavior.state = BottomSheetBehavior.STATE_EXPANDED
        sheet.setCancelable(true)
        sheet.setCanceledOnTouchOutside(true)

        val maxScrollHeight = (activity.resources.displayMetrics.heightPixels * 0.6f).toInt()
        binding.detailScrollView.post {
            if (binding.detailScrollView.height > maxScrollHeight) {
                binding.detailScrollView.layoutParams = binding.detailScrollView.layoutParams.apply {
                    height = maxScrollHeight
                }
            }
        }

        val processed = FeedbackFormatters.isProcessed(item.status)
        val statusLabel = FeedbackFormatters.statusLabel(activity, item.status)
        val statusColor = ContextCompat.getColor(
            activity,
            if (processed) R.color.feedback_status_processed else R.color.feedback_status_pending,
        )
        val statusBg = if (processed) {
            R.drawable.bg_feedback_status_pill_processed
        } else {
            R.drawable.bg_feedback_status_pill_pending
        }

        binding.detailStatusPill.text = statusLabel
        binding.detailStatusPill.setTextColor(statusColor)
        binding.detailStatusPill.setBackgroundResource(statusBg)

        binding.detailStatusValueText.text = statusLabel
        binding.detailStatusValueText.setTextColor(statusColor)

        binding.detailTypeIcon.setImageResource(FeedbackFormatters.typeIconRes(item.feedbackType))
        binding.detailTypeText.text = FeedbackFormatters.typeLabel(activity, item.feedbackType)

        binding.detailCreatedAtText.text = FeedbackFormatters.formatDetailTime(item.createdAt)
            .ifBlank { item.createdAt }

        val processedTime = if (processed) FeedbackFormatters.formatDetailTime(item.processedAt) else ""
        if (processed && processedTime.isNotBlank()) {
            binding.detailProcessedAtRow.visibility = View.VISIBLE
            binding.detailProcessedAtText.text = processedTime
        } else {
            binding.detailProcessedAtRow.visibility = View.GONE
        }

        val contact = item.contact?.trim().orEmpty()
        binding.detailContactText.text = contact.ifEmpty {
            activity.getString(R.string.feedback_detail_contact_empty)
        }

        binding.detailDescText.text = item.description

        renderImages(
            activity = activity,
            container = binding.detailImagesContainer,
            emptyView = binding.detailImagesEmptyText,
            imageUrls = item.images.mapNotNull { resolveImageUrl(it) },
        )

        binding.detailCloseButton.setOnClickListener {
            if (sheet.isShowing) sheet.dismiss()
        }

        sheet.show()
        PmMessage.register(sheet)
        return sheet
    }

    private fun renderImages(
        activity: Activity,
        container: LinearLayout,
        emptyView: View,
        imageUrls: List<String>,
    ) {
        container.removeAllViews()
        if (imageUrls.isEmpty()) {
            emptyView.visibility = View.VISIBLE
            container.visibility = View.GONE
            return
        }
        emptyView.visibility = View.GONE
        container.visibility = View.VISIBLE

        val density = activity.resources.displayMetrics.density
        val size = (76 * density + 0.5f).toInt()
        val gap = (10 * density + 0.5f).toInt()

        imageUrls.forEachIndexed { index, url ->
            val imageView = ShapeableImageView(activity).apply {
                layoutParams = LinearLayout.LayoutParams(size, size).apply {
                    if (index > 0) marginStart = gap
                }
                background = ContextCompat.getDrawable(activity, R.drawable.bg_feedback_history_placeholder)
                shapeAppearanceModel = ShapeAppearanceModel.builder()
                    .setAllCornerSizes(12 * density)
                    .build()
                scaleType = ImageView.ScaleType.CENTER_CROP
                contentDescription = activity.getString(R.string.feedback_image_preview_title)
                isClickable = true
                isFocusable = true
                load(url) {
                    crossfade(true)
                }
                setOnClickListener {
                    showImagePreviewDialog(activity, url)
                }
            }
            container.addView(imageView)
        }
    }

    private fun showImagePreviewDialog(activity: Activity, imageUrl: String) {
        val dialog = Dialog(activity, android.R.style.Theme_Black_NoTitleBar_Fullscreen)
        val previewBinding = DialogImagePreviewBinding.inflate(LayoutInflater.from(activity))
        dialog.setContentView(previewBinding.root)
        previewBinding.dialogPreviewTitleText.setText(R.string.feedback_image_preview_title)
        previewBinding.dialogPreviewImageView.load(imageUrl) {
            crossfade(true)
        }
        previewBinding.dialogPreviewCloseButton.setOnClickListener { dialog.dismiss() }
        previewBinding.dialogImagePreviewRoot.setOnClickListener { dialog.dismiss() }
        dialog.show()
        PmMessage.register(dialog)
    }
}
