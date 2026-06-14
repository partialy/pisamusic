package cn.partialy.pm.activity

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.view.View
import android.view.ViewGroup
import android.webkit.MimeTypeMap
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
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
import cn.partialy.pm.network.cookie.KugouCookieRepository
import cn.partialy.pm.network.cookie.WyCookieRepository
import cn.partialy.pm.sync.SyncManager
import cn.partialy.pm.ui.dialog.PmMinimalDialog
import cn.partialy.pm.ui.dialog.PmSlotDialog
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import coil.load
import coil.transform.CircleCropTransformation
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.textfield.TextInputEditText
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
    @Inject lateinit var kugouCookieRepository: KugouCookieRepository
    @Inject lateinit var wyCookieRepository: WyCookieRepository

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
        binding.accountProfileAvatar.setOnClickListener { showAvatarOptionsSheet() }
        binding.accountProfileAvatarChip.setOnClickListener { showAvatarOptionsSheet() }
        binding.accountProfileUsernameRow.setOnClickListener { showEditUsernameDialog() }
        binding.accountProfileEmailRow.setOnClickListener { showEditEmailDialog() }
        binding.accountProfileIdRow.setOnClickListener { copyUserIdToClipboard() }
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
            showMessage(getString(R.string.account_profile_not_logged_in))
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

    private fun copyUserIdToClipboard() {
        val userId = binding.accountProfileIdValue.text?.toString()?.trim().orEmpty()
        if (userId.isBlank()) return
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return
        clipboard.setPrimaryClip(ClipData.newPlainText("Pisa Music 用户 ID", userId))
        showMessage(getString(R.string.account_profile_id_copied))
    }

    private fun resolveAccountAvatarUrl(user: AccountUser): String? {
        val raw = user.avatarUrl.ifBlank { user.avatar }.trim()
        if (raw.isBlank()) return null
        if (raw.startsWith("http://") || raw.startsWith("https://")) return raw
        if (!raw.startsWith("/")) return null
        return BuildConfig.SYSTEM_SERVICE_BASE_URL.trimEnd('/') + raw
    }

    private data class AvatarOption(
        val label: String,
        val action: () -> Unit,
    )

    private fun showAvatarOptionsSheet() {
        val dialog = BottomSheetDialog(
            this,
            com.google.android.material.R.style.ThemeOverlay_Material3_BottomSheetDialog,
        )
        val root = layoutInflater.inflate(
            R.layout.layout_bottom_radius_options_sheet,
            null,
            false,
        ) as ViewGroup
        root.findViewById<TextView>(R.id.bottomRadiusOptionsSheetTitle).text =
            getString(R.string.account_profile_avatar_picker_title)
        val container = root.findViewById<LinearLayout>(R.id.bottomRadiusOptionsSheetContainer)
        root.findViewById<View>(R.id.bottomRadiusOptionsSheetCancel).setOnClickListener {
            dialog.dismiss()
        }
        root.findViewById<View>(R.id.bottomRadiusOptionsSheetConfirm).visibility = View.GONE

        val options = buildAvatarOptions()
        options.forEachIndexed { index, opt ->
            val row = layoutInflater.inflate(
                R.layout.item_account_profile_avatar_option,
                container,
                false,
            )
            row.findViewById<TextView>(R.id.avatarOptionLabel).apply {
                text = opt.label
                setOnClickListener {
                    dialog.dismiss()
                    opt.action()
                }
            }
            if (index == options.lastIndex) {
                row.findViewById<View>(R.id.avatarOptionDivider).visibility = View.GONE
            }
            container.addView(row)
        }

        dialog.setContentView(root)
        dialog.setOnShowListener {
            val sheet = dialog.findViewById<View>(
                com.google.android.material.R.id.design_bottom_sheet,
            ) ?: return@setOnShowListener
            BottomSheetBehavior.from(sheet as ViewGroup).apply {
                skipCollapsed = true
                state = BottomSheetBehavior.STATE_EXPANDED
            }
        }
        dialog.show()
    }

    private fun buildAvatarOptions(): List<AvatarOption> = buildList {
        add(
            AvatarOption(getString(R.string.account_profile_avatar_pick)) {
                pickAvatarLauncher.launch("image/*")
            },
        )
        add(
            AvatarOption(getString(R.string.account_profile_avatar_restore)) {
                restoreDefaultAvatar()
            },
        )
        val kgUrl = kugouCookieRepository.getProfile()?.avatarUrl?.trim().orEmpty()
        if (kugouCookieRepository.hasCookie() && kgUrl.isNotBlank()) {
            add(
                AvatarOption(getString(R.string.account_profile_avatar_use_kg)) {
                    useExternalAvatar(kgUrl)
                },
            )
        }
        val wyUrl = wyCookieRepository.getProfile()?.avatarUrl?.trim().orEmpty()
        if (wyCookieRepository.hasCookie() && wyUrl.isNotBlank()) {
            add(
                AvatarOption(getString(R.string.account_profile_avatar_use_wy)) {
                    useExternalAvatar(wyUrl)
                },
            )
        }
    }

    private fun showEditUsernameDialog() {
        PmSlotDialog.Builder(this)
            .setContentLayout(R.layout.dialog_account_profile_edit_username) { view, _ ->
                val input = view.findViewById<TextInputEditText>(R.id.usernameInput)
                val initial = binding.accountProfileUsernameValue.text?.toString().orEmpty()
                input.setText(initial)
                input.setSelection(initial.length)
                input.requestFocus()
            }
            .setCancelButton(getString(R.string.account_profile_edit_cancel))
            .setConfirmButton(
                text = getString(R.string.account_profile_edit_confirm),
                dismissOnConfirm = false,
            ) { dialog ->
                val input = dialog.findViewById<TextInputEditText>(R.id.usernameInput)
                    ?: return@setConfirmButton
                val newName = input.text?.toString()?.trim().orEmpty()
                if (newName.isBlank()) {
                    showMessage(getString(R.string.account_profile_username_required))
                    return@setConfirmButton
                }
                binding.accountProfileUsernameValue.text = newName
                dialog.dismiss()
            }
            .show()
    }

    private fun showEditEmailDialog() {
        var cooldownJob: Job? = null
        PmSlotDialog.Builder(this)
            .setContentLayout(R.layout.dialog_account_profile_edit_email) { view, dialog ->
                val emailInput = view.findViewById<TextInputEditText>(R.id.emailInput)
                val sendCodeButton = view.findViewById<TextView>(R.id.sendCodeButton)
                sendCodeButton.setOnClickListener {
                    val emailText = emailInput.text?.toString()?.trim().orEmpty()
                    if (emailText.isBlank()) {
                        showMessage(getString(R.string.account_profile_email_required))
                        return@setOnClickListener
                    }
                    val session = AccountSessionStore.read(this)
                    if (!session.loggedIn) {
                        showMessage(getString(R.string.account_profile_not_logged_in))
                        return@setOnClickListener
                    }
                    sendCodeButton.isEnabled = false
                    lifecycleScope.launch {
                        runCatching {
                            withContext(Dispatchers.IO) {
                                configManager.sendAccountProfileEmailCode(session.token, emailText)
                            }
                        }.onSuccess {
                            showMessage(getString(R.string.account_profile_email_code_sent))
                            cooldownJob?.cancel()
                            cooldownJob = startCooldown(sendCodeButton)
                        }.onFailure {
                            sendCodeButton.isEnabled = true
                            showMessage(it.message ?: getString(R.string.account_profile_email_code_failed))
                        }
                    }
                }
                dialog.setOnDismissListener { cooldownJob?.cancel() }
            }
            .setCancelButton(getString(R.string.account_profile_edit_cancel))
            .setConfirmButton(
                text = getString(R.string.account_profile_edit_confirm),
                dismissOnConfirm = false,
            ) { dialog ->
                val emailInput = dialog.findViewById<TextInputEditText>(R.id.emailInput)
                val codeInput = dialog.findViewById<TextInputEditText>(R.id.codeInput)
                if (emailInput == null || codeInput == null) return@setConfirmButton
                val newEmail = emailInput.text?.toString()?.trim().orEmpty()
                val code = codeInput.text?.toString()?.trim().orEmpty()
                if (newEmail.isBlank()) {
                    showMessage(getString(R.string.account_profile_email_required))
                    return@setConfirmButton
                }
                if (code.isBlank()) {
                    showMessage(getString(R.string.account_profile_email_code_required))
                    return@setConfirmButton
                }
                pendingNewEmail = newEmail
                binding.accountProfileEmailValue.text = newEmail
                commitProfile(
                    username = binding.accountProfileUsernameValue.text?.toString()?.trim().orEmpty(),
                    email = newEmail,
                    code = code,
                )
                dialog.dismiss()
            }
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

    private fun saveProfile() {
        val username = binding.accountProfileUsernameValue.text?.toString()?.trim().orEmpty()
        val email = binding.accountProfileEmailValue.text?.toString()?.trim().orEmpty()
        if (username.isBlank()) {
            showMessage(getString(R.string.account_profile_username_required))
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
                showMessage(getString(R.string.account_profile_save_success))
            }.onFailure {
                showMessage(it.message ?: getString(R.string.account_profile_save_failed))
            }
            binding.accountProfileSaveButton.isEnabled = true
        }
    }

    private fun uploadSelectedAvatar(uri: Uri) {
        val session = currentSessionOrFinish() ?: return
        lifecycleScope.launch {
            runCatching {
                val result = withContext(Dispatchers.IO) {
                    val picked = readPickedAvatar(uri)
                    uploadAvatarBytes(session.token, picked)
                }
                AccountSessionStore.save(this@AccountProfileActivity, result)
            }.onSuccess {
                renderProfile()
                showMessage(getString(R.string.account_profile_avatar_updated))
            }.onFailure {
                showMessage(it.message ?: getString(R.string.account_profile_avatar_upload_failed))
            }
        }
    }

    private fun useExternalAvatar(sourceUrl: String) {
        if (sourceUrl.isBlank()) {
            showMessage(getString(R.string.account_profile_avatar_no_source))
            return
        }
        val session = currentSessionOrFinish() ?: return
        lifecycleScope.launch {
            runCatching {
                val result = withContext(Dispatchers.IO) {
                    val picked = downloadExternalAvatar(sourceUrl)
                        ?: throw IllegalStateException(getString(R.string.account_profile_avatar_use_failed))
                    uploadAvatarBytes(session.token, picked)
                }
                AccountSessionStore.save(this@AccountProfileActivity, result)
            }.onSuccess {
                renderProfile()
                showMessage(getString(R.string.account_profile_avatar_updated))
            }.onFailure {
                showMessage(it.message ?: getString(R.string.account_profile_avatar_use_failed))
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
                showMessage(getString(R.string.account_profile_avatar_restored))
            }.onFailure {
                showMessage(it.message ?: getString(R.string.account_profile_avatar_restore_failed))
            }
        }
    }

    private suspend fun uploadAvatarBytes(token: String, picked: PickedAvatar): AccountAuthResult {
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

    private fun downloadExternalAvatar(url: String): PickedAvatar? {
        val request = Request.Builder().url(url).build()
        avatarHttpClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return null
            val rawMime = response.header("Content-Type").orEmpty()
            val mimeType = rawMime.substringBefore(';').trim().takeIf { it.startsWith("image/") }
                ?: "image/jpeg"
            val bytes = response.body?.bytes() ?: return null
            if (bytes.isEmpty()) return null
            require(bytes.size <= MAX_AVATAR_BYTES) { "头像文件不能超过 5MB" }
            val fileName = "external_avatar.${extensionForMime(mimeType)}"
            return PickedAvatar(fileName, mimeType, bytes)
        }
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
            confirmText = getString(R.string.account_profile_logout_confirm),
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
