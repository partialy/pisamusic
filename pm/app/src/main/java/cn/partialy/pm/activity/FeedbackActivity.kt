package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityFeedbackBinding
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.utils.ServerDevicePrefs
import coil.load
import com.google.android.material.imageview.ShapeableImageView
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import javax.inject.Named
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

@AndroidEntryPoint
class FeedbackActivity : BaseActivity() {

    private lateinit var binding: ActivityFeedbackBinding

    @Inject
    @Named("system_api_base_url")
    lateinit var systemApiBaseUrl: String

    private val httpClient = OkHttpClient()

    private val pickedImages = mutableListOf<Uri>()
    private var selectedType: String = TYPE_BUG
    private var submitting: Boolean = false

    private val pickImagesLauncher =
        registerForActivityResult(
            ActivityResultContracts.PickMultipleVisualMedia(MAX_IMAGES),
        ) { uris ->
            if (uris.isNullOrEmpty()) return@registerForActivityResult
            val remaining = MAX_IMAGES - pickedImages.size
            if (remaining <= 0) return@registerForActivityResult
            pickedImages.addAll(uris.take(remaining))
            renderImagePreviews()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityFeedbackBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        val isNight =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(
            lightStatusBarIcons = !isNight,
            lightNavigationBarIcons = !isNight,
        )
        binding.feedbackRoot.applySystemBarsInsets { insets ->
            val lp = binding.feedbackStatusBarSpacer.layoutParams
            lp.height = insets.top
            binding.feedbackStatusBarSpacer.layoutParams = lp
            binding.feedbackScrollView.setPadding(0, 0, 0, insets.bottom)
        }

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() = finish()
            },
        )

        binding.feedbackBackButton.setOnClickListener { finish() }
        bindTypeChips()
        renderImagePreviews()

        binding.feedbackSubmitButton.setOnClickListener { onSubmitClicked() }
    }

    private fun bindTypeChips() {
        val mapping = listOf(
            Triple(TYPE_BUG, binding.feedbackTypeBug, binding.feedbackTypeBugText to binding.feedbackTypeBugIcon),
            Triple(TYPE_SUGGESTION, binding.feedbackTypeSuggestion, binding.feedbackTypeSuggestionText to binding.feedbackTypeSuggestionIcon),
            Triple(TYPE_ACCOUNT, binding.feedbackTypeAccount, binding.feedbackTypeAccountText to binding.feedbackTypeAccountIcon),
            Triple(TYPE_OTHER, binding.feedbackTypeOther, binding.feedbackTypeOtherText to binding.feedbackTypeOtherIcon),
        )
        mapping.forEach { (key, container, textIcon) ->
            container.setOnClickListener {
                if (selectedType == key) return@setOnClickListener
                selectedType = key
                refreshTypeChips(mapping)
            }
        }
        refreshTypeChips(mapping)
    }

    private fun refreshTypeChips(
        mapping: List<Triple<String, ViewGroup, Pair<android.widget.TextView, ImageView>>>,
    ) {
        val selectedColor = ContextCompat.getColor(this, R.color.feedback_chip_selected_text)
        val defaultColor = ContextCompat.getColor(this, R.color.feedback_chip_default_text)
        mapping.forEach { (key, container, textIcon) ->
            val on = key == selectedType
            container.isSelected = on
            val color = if (on) selectedColor else defaultColor
            textIcon.first.setTextColor(color)
            textIcon.second.setColorFilter(color)
        }
    }

    private fun renderImagePreviews() {
        val container = binding.feedbackImagesContainer
        container.removeAllViews()
        val density = resources.displayMetrics.density
        val size = (76 * density + 0.5f).toInt()
        val gap = (10 * density + 0.5f).toInt()

        pickedImages.forEachIndexed { index, uri ->
            val frame = FrameLayout(this).apply {
                layoutParams = LinearLayout.LayoutParams(size, size).apply {
                    if (index > 0) marginStart = gap
                }
                background = ContextCompat.getDrawable(this@FeedbackActivity, R.drawable.bg_feedback_image_preview)
                clipToOutline = true
            }
            val image = ShapeableImageView(this).apply {
                layoutParams = FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                )
                shapeAppearanceModel = com.google.android.material.shape.ShapeAppearanceModel.builder()
                    .setAllCornerSizes(16 * density)
                    .build()
                scaleType = ImageView.ScaleType.CENTER_CROP
                load(uri)
            }
            val deleteSize = (22 * density + 0.5f).toInt()
            val delete = ImageButton(this).apply {
                layoutParams = FrameLayout.LayoutParams(deleteSize, deleteSize).apply {
                    gravity = android.view.Gravity.TOP or android.view.Gravity.END
                    topMargin = (4 * density + 0.5f).toInt()
                    marginEnd = (4 * density + 0.5f).toInt()
                }
                setBackgroundResource(R.drawable.bg_feedback_image_delete)
                setImageResource(R.drawable.ic_close_24dp)
                setPadding(
                    (4 * density + 0.5f).toInt(),
                    (4 * density + 0.5f).toInt(),
                    (4 * density + 0.5f).toInt(),
                    (4 * density + 0.5f).toInt(),
                )
                scaleType = ImageView.ScaleType.FIT_CENTER
                contentDescription = getString(R.string.feedback_image_delete)
                setColorFilter(android.graphics.Color.WHITE)
                setOnClickListener {
                    pickedImages.removeAt(index)
                    renderImagePreviews()
                }
            }
            frame.addView(image)
            frame.addView(delete)
            container.addView(frame)
        }

        if (pickedImages.size < MAX_IMAGES) {
            val pickBtn = LinearLayout(this).apply {
                layoutParams = LinearLayout.LayoutParams(size, size).apply {
                    if (pickedImages.isNotEmpty()) marginStart = gap
                }
                background = ContextCompat.getDrawable(this@FeedbackActivity, R.drawable.bg_feedback_pick_button)
                orientation = LinearLayout.VERTICAL
                gravity = android.view.Gravity.CENTER
                isClickable = true
                isFocusable = true
                setOnClickListener {
                    pickImagesLauncher.launch(
                        PickVisualMediaRequest(
                            ActivityResultContracts.PickVisualMedia.ImageOnly,
                        ),
                    )
                }
            }
            val iconSize = (22 * density + 0.5f).toInt()
            val icon = ImageView(this).apply {
                layoutParams = LinearLayout.LayoutParams(iconSize, iconSize)
                setImageResource(R.drawable.ic_plus_24)
                setColorFilter(
                    ContextCompat.getColor(this@FeedbackActivity, R.color.feedback_pick_button_icon),
                )
            }
            val label = android.widget.TextView(this).apply {
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                ).apply { topMargin = (4 * density + 0.5f).toInt() }
                text = "上传"
                textSize = 10f
                setTextColor(
                    ContextCompat.getColor(this@FeedbackActivity, R.color.feedback_pick_button_icon),
                )
            }
            pickBtn.addView(icon)
            pickBtn.addView(label)
            container.addView(pickBtn)
        }
    }

    private fun onSubmitClicked() {
        if (submitting) return
        val desc = binding.feedbackDescInput.text?.toString()?.trim().orEmpty()
        if (desc.isBlank()) {
            showMessage(getString(R.string.feedback_desc_required))
            binding.feedbackDescInput.requestFocus()
            return
        }
        val contact = binding.feedbackContactInput.text?.toString()?.trim().orEmpty()
        submitFeedback(desc, contact)
    }

    private fun submitFeedback(description: String, contact: String) {
        submitting = true
        binding.feedbackSubmitButton.isEnabled = false
        binding.feedbackSubmitButton.alpha = 0.7f

        val typeForUpload = selectedType
        val device = buildDeviceMetaJson()
        val images = pickedImages.toList()

        lifecycleScope.launch {
            val result = runCatching {
                withContext(Dispatchers.IO) {
                    uploadFeedback(
                        type = typeForUpload,
                        description = description,
                        contact = contact,
                        device = device,
                        images = images,
                    )
                }
            }
            submitting = false
            binding.feedbackSubmitButton.isEnabled = true
            binding.feedbackSubmitButton.alpha = 1f
            result.onSuccess { resp ->
                val msg = resp.msg?.takeIf { it.isNotBlank() }
                if (resp.success) {
                    showMessage(msg ?: getString(R.string.feedback_submitted))
                    finish()
                } else {
                    showMessage(msg ?: getString(R.string.feedback_submit_failed))
                }
            }.onFailure {
                showMessage(getString(R.string.feedback_network_error))
            }
        }
    }

    private suspend fun uploadFeedback(
        type: String,
        description: String,
        contact: String,
        device: String,
        images: List<Uri>,
    ): FeedbackSubmitResponse {
        val url = systemApiBaseUrl.trimEnd('/') + "/api/feedback"
        val builder = MultipartBody.Builder().setType(MultipartBody.FORM)
            .addFormDataPart("feedback_type", type)
            .addFormDataPart("description", description)
            .addFormDataPart("contact", contact)
            .addFormDataPart("device", device)
        images.forEachIndexed { index, uri ->
            val mime = contentResolver.getType(uri) ?: "image/jpeg"
            val ext = when {
                mime.endsWith("/png", ignoreCase = true) -> "png"
                mime.endsWith("/webp", ignoreCase = true) -> "webp"
                else -> "jpg"
            }
            val bytes = contentResolver.openInputStream(uri)?.use { it.readBytes() }
                ?: throw IllegalStateException("图片读取失败")
            require(bytes.isNotEmpty()) { "图片内容为空" }
            builder.addFormDataPart(
                "images",
                "image_${index + 1}.$ext",
                bytes.toRequestBody(mime.toMediaTypeOrNull()),
            )
        }
        val request = Request.Builder().url(url).post(builder.build()).build()
        httpClient.newCall(request).execute().use { response ->
            val body = response.body?.string().orEmpty()
            if (body.isBlank()) {
                throw IllegalStateException("HTTP ${response.code}")
            }
            val json = runCatching { JSONObject(body) }.getOrNull()
                ?: throw IllegalStateException("响应解析失败")
            val success = json.optBoolean("success", false)
            val msg = json.optString("msg").takeIf { it.isNotBlank() }
            return FeedbackSubmitResponse(success = success, msg = msg)
        }
    }

    private fun buildDeviceMetaJson(): String {
        return runCatching {
            val pi = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                packageManager.getPackageInfo(
                    packageName,
                    PackageManager.PackageInfoFlags.of(0L),
                )
            } else {
                @Suppress("DEPRECATION")
                packageManager.getPackageInfo(packageName, 0)
            }
            val vc = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                pi.longVersionCode
            } else {
                @Suppress("DEPRECATION")
                pi.versionCode.toLong()
            }
            JSONObject().apply {
                put("manufacturer", Build.MANUFACTURER ?: "")
                put("brand", Build.BRAND ?: "")
                put("model", Build.MODEL ?: "")
                put("device", Build.DEVICE ?: "")
                put("product", Build.PRODUCT ?: "")
                put("display", Build.DISPLAY ?: "")
                put("sdkInt", Build.VERSION.SDK_INT)
                put("release", Build.VERSION.RELEASE ?: "")
                put("versionName", pi.versionName ?: "")
                put("versionCode", vc)
                put("packageName", packageName ?: "")
                put("serverDeviceId", ServerDevicePrefs.getDeviceId(this@FeedbackActivity))
            }.toString()
        }.getOrDefault("{}")
    }

    private data class FeedbackSubmitResponse(
        val success: Boolean,
        val msg: String?,
    )

    companion object {
        private const val TYPE_BUG = "bug"
        private const val TYPE_SUGGESTION = "suggestion"
        private const val TYPE_ACCOUNT = "account"
        private const val TYPE_OTHER = "other"
        private const val MAX_IMAGES = 3

        fun start(context: Context) {
            context.startActivity(Intent(context, FeedbackActivity::class.java))
            AppActivityTransitions.applyForward(context)
        }
    }
}
