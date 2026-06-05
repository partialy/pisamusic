package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.text.InputType
import android.view.View
import android.view.ViewGroup
import android.webkit.MimeTypeMap
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.BuildConfig
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityAccountProfileBinding
import cn.partialy.pm.model.AccountAuthResult
import cn.partialy.pm.model.AccountUser
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.config.ConfigManager
import cn.partialy.pm.sync.SyncManager
import cn.partialy.pm.ui.dialog.PmMinimalDialog
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import coil.load
import coil.transform.CircleCropTransformation
import com.google.android.material.bottomsheet.BottomSheetDialog
import dagger.hilt.android.AndroidEntryPoint
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

@AndroidEntryPoint
class AccountProfileActivity : BaseActivity() {
    private lateinit var binding: ActivityAccountProfileBinding
    private val avatarHttpClient = OkHttpClient()
    private var pendingNewEmail: String? = null

    private val pickAvatarLauncher =
        registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
            if (uri != null) uploadSelectedAvatar(uri)
        }

    @Inject lateinit var configManager: ConfigManager
    @Inject lateinit var syncManager: SyncManager
    @Inject lateinit var playlistCollectionManager: PlaylistCollectionManager

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityAccountProfileBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        val isNight =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(
            lightStatusBarIcons = !isNight,
            lightNavigationBarIcons = !isNight,
        )
        binding.accountProfileRoot.applySystemBarsInsets { insets ->
            val lp = binding.accountProfileStatusBarSpacer.layoutParams
            lp.height = insets.top
            binding.accountProfileStatusBarSpacer.layoutParams = lp
            binding.accountProfileScrollView.setPadding(0, 0, 0, insets.bottom)
        }

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() = finish()
            },
        )

        binding.accountProfileBackButton.setOnClickListener { finish() }
        binding.accountProfileAvatar.setOnClickListener { showAvatarPicker() }
        binding.accountProfileAvatarChip.setOnClickListener { showAvatarPicker() }
        binding.accountProfileUsernameRow.setOnClickListener { showEditUsernameDialog() }
        binding.accountProfileEmailRow.setOnClickListener { showEditEmailDialog() }
        binding.accountProfileSaveButton.setOnClickListener { saveProfile() }
        binding.accountProfileLogoutButton.setOnClickListener { confirmLogout() }
    }

    override fun onResume() {
        super.onResume()
        renderProfile()
    }

    private fun currentSessionOrFinish(): AccountSessionStore.Session? {
        val session = AccountSessionStore.read(this)
        if (!session.loggedIn) {
            Toast.makeText(this, R.string.account_profile_not_logged_in, Toast.LENGTH_SHORT).show()
            finish()
            return null
        }
        return session
    }

    private fun renderProfile() {
        val session = currentSessionOrFinish() ?: return
        val user = session.user
        binding.accountProfileUsernameValue.text = user.username
        binding.accountProfileEmailValue.text = user.email
        binding.accountProfileIdValue.text = user.id
        binding.accountProfileCreatedAtValue.text = formatDate(user.createdAt)
        binding.accountProfileLastLoginValue.text = formatDateTime(user.lastLoginAt)

        val avatarUrl = resolveAccountAvatarUrl(user)
        if (avatarUrl == null) {
            binding.accountProfileAvatar.setImageResource(R.drawable.ic_pm_icon)
        } else {
            binding.accountProfileAvatar.load(avatarUrl) {
                placeholder(R.drawable.ic_pm_icon)
                error(R.drawable.ic_pm_icon)
                transformations(CircleCropTransformation())
            }
        }

        renderStats()
    }

    private fun renderStats() {
        val loveCount = loveManager.loveListFlow.value.size
        val playlists = playlistCollectionManager.playlistsFlow.value
        val localCount = playlists.count { it.type == CollectedPlaylistType.LOCAL }
        val collectedCount = playlists.size - localCount
        binding.accountProfileLoveCountValue.text =
            "${formatCount(loveCount)} ${getString(R.string.account_profile_unit_song)}"
        binding.accountProfileCollectedPlaylistsValue.text =
            "${formatCount(collectedCount)} ${getString(R.string.account_profile_unit_playlist)}"
        binding.accountProfileLocalPlaylistsValue.text =
            "${formatCount(localCount)} ${getString(R.string.account_profile_unit_playlist)}"
    }

    private fun formatCount(value: Int): String = String.format(Locale.US, "%,d", value)

    private fun formatDate(timestamp: Long): String {
        if (timestamp <= 0L) return getString(R.string.account_profile_value_placeholder)
        return SimpleDateFormat("yyyy年MM月dd日", Locale.CHINA).format(Date(timestamp))
    }

    private fun formatDateTime(timestamp: Long?): String {
        if (timestamp == null || timestamp <= 0L) {
            return getString(R.string.account_profile_value_placeholder)
        }
        return SimpleDateFormat("yyyy年MM月dd日 HH:mm", Locale.CHINA).format(Date(timestamp))
    }

    private fun resolveAccountAvatarUrl(user: AccountUser): String? {
        val raw = user.avatarUrl.ifBlank { user.avatar }.trim()
        if (raw.isBlank()) return null
        if (raw.startsWith("http://") || raw.startsWith("https://")) return raw
        if (!raw.startsWith("/")) return null
        return BuildConfig.SYSTEM_SERVICE_BASE_URL.trimEnd('/') + raw
    }

    private fun showAvatarPicker() {
        val dialog = BottomSheetDialog(this)
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, dpToPx(12), 0, dpToPx(24))
        }
        container.addView(
            makeSheetItem(getString(R.string.account_profile_avatar_pick)) {
                dialog.dismiss()
                pickAvatarLauncher.launch("image/*")
            },
        )
        container.addView(
            makeSheetItem(
                text = getString(R.string.account_profile_avatar_restore),
                tintRes = R.color.account_profile_logout_text,
            ) {
                dialog.dismiss()
                restoreDefaultAvatar()
            },
        )
        dialog.setContentView(container)
        dialog.show()
    }

    private fun makeSheetItem(
        text: String,
        tintRes: Int = R.color.account_profile_value,
        onClick: () -> Unit,
    ): TextView {
        val item = TextView(this)
        val lp = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dpToPx(52),
        )
        item.layoutParams = lp
        item.gravity = android.view.Gravity.CENTER
        item.text = text
        item.textSize = 15f
        item.setTextColor(ContextCompat.getColor(this, tintRes))
        val outValue = android.util.TypedValue()
        theme.resolveAttribute(android.R.attr.selectableItemBackground, outValue, true)
        item.setBackgroundResource(outValue.resourceId)
        item.isClickable = true
        item.setOnClickListener { onClick() }
        return item
    }

    private fun dpToPx(dp: Int): Int =
        (dp * resources.displayMetrics.density + 0.5f).toInt()

    private fun showEditUsernameDialog() {
        val edit = makeDialogEditText(
            initial = binding.accountProfileUsernameValue.text?.toString().orEmpty(),
            hint = getString(R.string.account_profile_edit_username_hint),
            inputType = InputType.TYPE_CLASS_TEXT,
            maxLength = 32,
        )
        val container = wrapDialogContent(edit)
        AlertDialog.Builder(this)
            .setTitle(R.string.account_profile_edit_username_title)
            .setView(container)
            .setNegativeButton("取消", null)
            .setPositiveButton("确认") { _, _ ->
                val newName = edit.text?.toString()?.trim().orEmpty()
                if (newName.isBlank()) {
                    Toast.makeText(this, R.string.account_profile_username_required, Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                binding.accountProfileUsernameValue.text = newName
            }
            .show()
    }

    private fun showEditEmailDialog() {
        val emailEdit = makeDialogEditText(
            initial = "",
            hint = getString(R.string.account_profile_edit_email_hint),
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS,
            maxLength = 64,
        )
        val codeEdit = makeDialogEditText(
            initial = "",
            hint = getString(R.string.account_profile_edit_code_hint),
            inputType = InputType.TYPE_CLASS_NUMBER,
            maxLength = 6,
        )
        val sendCodeButton = TextView(this).apply {
            text = getString(R.string.account_profile_send_code)
            setTextColor(ContextCompat.getColor(this@AccountProfileActivity, R.color.account_profile_save_button_bg))
            textSize = 14f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(dpToPx(12), dpToPx(8), dpToPx(12), dpToPx(8))
            isClickable = true
            val outValue = android.util.TypedValue()
            this@AccountProfileActivity.theme.resolveAttribute(
                android.R.attr.selectableItemBackground, outValue, true,
            )
            setBackgroundResource(outValue.resourceId)
        }

        val codeRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            val params = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            )
            params.topMargin = dpToPx(12)
            layoutParams = params
            val codeLp = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
            addView(codeEdit, codeLp)
            addView(sendCodeButton)
        }
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dpToPx(24), dpToPx(8), dpToPx(24), 0)
            addView(emailEdit)
            addView(codeRow)
        }

        var cooldownJob: Job? = null
        sendCodeButton.setOnClickListener {
            val emailText = emailEdit.text?.toString()?.trim().orEmpty()
            if (emailText.isBlank()) {
                Toast.makeText(this, R.string.account_profile_email_required, Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            val session = AccountSessionStore.read(this)
            if (!session.loggedIn) {
                Toast.makeText(this, R.string.account_profile_not_logged_in, Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            sendCodeButton.isEnabled = false
            lifecycleScope.launch {
                runCatching {
                    withContext(Dispatchers.IO) {
                        configManager.sendAccountProfileEmailCode(session.token, emailText)
                    }
                }.onSuccess {
                    Toast.makeText(
                        this@AccountProfileActivity,
                        R.string.account_profile_email_code_sent,
                        Toast.LENGTH_SHORT,
                    ).show()
                    cooldownJob?.cancel()
                    cooldownJob = startCooldown(sendCodeButton)
                }.onFailure {
                    sendCodeButton.isEnabled = true
                    Toast.makeText(this@AccountProfileActivity, it.message ?: "验证码发送失败", Toast.LENGTH_SHORT).show()
                }
            }
        }

        AlertDialog.Builder(this)
            .setTitle(R.string.account_profile_edit_email_title)
            .setView(container)
            .setNegativeButton("取消", null)
            .setPositiveButton("确定更改") { _, _ ->
                val newEmail = emailEdit.text?.toString()?.trim().orEmpty()
                val code = codeEdit.text?.toString()?.trim().orEmpty()
                if (newEmail.isBlank()) {
                    Toast.makeText(this, R.string.account_profile_email_required, Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                if (code.isBlank()) {
                    Toast.makeText(this, R.string.account_profile_email_code_required, Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                pendingNewEmail = newEmail
                binding.accountProfileEmailValue.text = newEmail
                commitProfile(
                    username = binding.accountProfileUsernameValue.text?.toString()?.trim().orEmpty(),
                    email = newEmail,
                    code = code,
                )
            }
            .setOnDismissListener { cooldownJob?.cancel() }
            .show()
    }

    private fun startCooldown(button: TextView): Job {
        return lifecycleScope.launch {
            var remaining = 60
            while (remaining > 0) {
                button.text = getString(R.string.account_profile_send_code_countdown, remaining)
                delay(1000)
                remaining--
            }
            button.text = getString(R.string.account_profile_resend_code)
            button.isEnabled = true
        }
    }

    private fun makeDialogEditText(
        initial: String,
        hint: String,
        inputType: Int,
        maxLength: Int,
    ): EditText {
        return EditText(this).apply {
            this.inputType = inputType
            this.hint = hint
            setText(initial)
            setSelection(text.length)
            filters = arrayOf(android.text.InputFilter.LengthFilter(maxLength))
            val params = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            )
            layoutParams = params
        }
    }

    private fun wrapDialogContent(child: View): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dpToPx(24), dpToPx(8), dpToPx(24), 0)
            addView(child)
        }
    }

    private fun saveProfile() {
        val username = binding.accountProfileUsernameValue.text?.toString()?.trim().orEmpty()
        val email = binding.accountProfileEmailValue.text?.toString()?.trim().orEmpty()
        if (username.isBlank()) {
            Toast.makeText(this, R.string.account_profile_username_required, Toast.LENGTH_SHORT).show()
            return
        }
        commitProfile(username = username, email = email, code = null)
    }

    private fun commitProfile(username: String, email: String, code: String?) {
        val session = currentSessionOrFinish() ?: return
        binding.accountProfileSaveButton.isEnabled = false
        lifecycleScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    configManager.updateAccountProfile(
                        token = session.token,
                        username = username,
                        email = email,
                        code = code,
                        avatarKey = null,
                    )
                }
            }.onSuccess { result ->
                AccountSessionStore.save(this@AccountProfileActivity, result)
                pendingNewEmail = null
                renderProfile()
                Toast.makeText(
                    this@AccountProfileActivity,
                    R.string.account_profile_save_success,
                    Toast.LENGTH_SHORT,
                ).show()
            }.onFailure {
                Toast.makeText(this@AccountProfileActivity, it.message ?: "资料保存失败", Toast.LENGTH_SHORT).show()
            }
            binding.accountProfileSaveButton.isEnabled = true
        }
    }

    private fun uploadSelectedAvatar(uri: Uri) {
        val session = currentSessionOrFinish() ?: return
        lifecycleScope.launch {
            runCatching {
                val result = withContext(Dispatchers.IO) {
                    uploadAccountAvatar(session.token, uri)
                }
                AccountSessionStore.save(this@AccountProfileActivity, result)
                result.user
            }.onSuccess { _ ->
                renderProfile()
                Toast.makeText(
                    this@AccountProfileActivity,
                    R.string.account_profile_avatar_updated,
                    Toast.LENGTH_SHORT,
                ).show()
            }.onFailure {
                Toast.makeText(this@AccountProfileActivity, it.message ?: "头像上传失败", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun restoreDefaultAvatar() {
        val session = currentSessionOrFinish() ?: return
        lifecycleScope.launch {
            runCatching {
                val result = withContext(Dispatchers.IO) {
                    configManager.updateAccountProfile(
                        token = session.token,
                        username = null,
                        email = null,
                        code = null,
                        avatarKey = "default",
                    )
                }
                AccountSessionStore.save(this@AccountProfileActivity, result)
            }.onSuccess {
                renderProfile()
                Toast.makeText(
                    this@AccountProfileActivity,
                    R.string.account_profile_avatar_restored,
                    Toast.LENGTH_SHORT,
                ).show()
            }.onFailure {
                Toast.makeText(this@AccountProfileActivity, it.message ?: "恢复默认头像失败", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private suspend fun uploadAccountAvatar(token: String, uri: Uri): AccountAuthResult {
        val picked = readPickedAvatar(uri)
        val uploadToken = configManager.requestAccountAvatarUploadToken(
            token = token,
            fileName = picked.fileName,
            fileSize = picked.bytes.size.toLong(),
            mimeType = picked.mimeType,
        )
        val body = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("token", uploadToken.uploadToken)
            .addFormDataPart("key", uploadToken.key)
            .addFormDataPart(
                "file",
                picked.fileName,
                picked.bytes.toRequestBody(picked.mimeType.toMediaTypeOrNull()),
            )
            .build()
        val request = Request.Builder()
            .url(uploadToken.uploadUrl)
            .post(body)
            .build()
        avatarHttpClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IllegalStateException("七牛上传失败：HTTP ${response.code}")
            }
        }
        return configManager.updateAccountProfile(
            token = token,
            username = null,
            email = null,
            code = null,
            avatarKey = uploadToken.key,
        )
    }

    private fun readPickedAvatar(uri: Uri): PickedAvatar {
        val mimeType = contentResolver.getType(uri) ?: "image/jpeg"
        val fileName = normalizeAvatarFileName(queryDisplayName(uri), mimeType)
        val bytes = contentResolver.openInputStream(uri)?.use { it.readBytes() }
            ?: throw IllegalStateException("头像文件读取失败")
        require(bytes.isNotEmpty()) { "头像文件为空" }
        require(bytes.size <= MAX_AVATAR_BYTES) { "头像文件不能超过 5MB" }
        return PickedAvatar(fileName, mimeType, bytes)
    }

    private fun queryDisplayName(uri: Uri): String {
        return runCatching {
            contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                if (!cursor.moveToFirst()) return@use ""
                val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (index >= 0) cursor.getString(index).orEmpty() else ""
            }.orEmpty()
        }.getOrDefault("")
    }

    private fun extensionForMime(mimeType: String): String =
        MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType)?.takeIf { it.isNotBlank() } ?: "jpg"

    private fun normalizeAvatarFileName(rawName: String, mimeType: String): String {
        val cleanName = rawName.trim().ifBlank { "avatar" }
        val hasExtension = cleanName.substringAfterLast('.', "").isNotBlank()
        return if (hasExtension) cleanName else "$cleanName.${extensionForMime(mimeType)}"
    }

    private fun confirmLogout() {
        PmMinimalDialog.show(
            context = this,
            title = getString(R.string.account_profile_logout_title),
            message = getString(R.string.account_profile_logout_message),
            confirmText = "确定退出",
            confirmColor = ContextCompat.getColor(this, R.color.account_profile_logout_text),
        ) {
            lifecycleScope.launch {
                withContext(Dispatchers.IO) {
                    syncManager.clearLocalSyncState()
                    AccountSessionStore.clear(this@AccountProfileActivity)
                }
                finish()
            }
        }
    }

    private data class PickedAvatar(
        val fileName: String,
        val mimeType: String,
        val bytes: ByteArray,
    )

    companion object {
        private const val MAX_AVATAR_BYTES = 5 * 1024 * 1024

        fun start(context: Context) {
            context.startActivity(Intent(context, AccountProfileActivity::class.java))
            AppActivityTransitions.applyForward(context)
        }
    }
}
