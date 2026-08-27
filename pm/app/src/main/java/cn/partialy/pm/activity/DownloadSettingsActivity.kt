package cn.partialy.pm.activity

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.net.toUri
import androidx.documentfile.provider.DocumentFile
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.ui.dialog.SettingsOption
import cn.partialy.pm.ui.dialog.showSettingsOptionPicker
import cn.partialy.pm.ui.settings.SubSettingsItem
import cn.partialy.pm.ui.settings.SubSettingsSection
import cn.partialy.pm.utils.DownloadPathManager
import cn.partialy.pm.utils.SettingsPrefs
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.snackbar.Snackbar
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class DownloadSettingsActivity : SubSettingsActivity() {
    override val settingsPageTitle: CharSequence by lazy { getString(R.string.settings_download_title) }

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { permissions ->
        if (
            permissions.getOrDefault(Manifest.permission.READ_MEDIA_AUDIO, false) ||
            permissions.getOrDefault(Manifest.permission.READ_EXTERNAL_STORAGE, false)
        ) {
            showDirectoryPicker()
        } else {
            showPermissionDeniedMessage()
        }
    }

    private val directoryPickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        if (result.resultCode != RESULT_OK) return@registerForActivityResult
        result.data?.data?.let(::saveDownloadPath)
    }

    override fun createSettingsSections(): List<SubSettingsSection> = listOf(
        SubSettingsSection(
            id = "download",
            items = listOf(
                SubSettingsItem.Option(
                    id = ITEM_DOWNLOAD_LOCATION,
                    title = getString(R.string.download_location),
                    value = DownloadPathManager.getDisplayPath(this),
                    summary = getString(R.string.settings_download_directory_summary),
                ),
                SubSettingsItem.Option(
                    id = ITEM_FILE_NAMING_RULE,
                    title = getString(R.string.settings_file_naming_title),
                    value = fileNamingRuleSummary(SettingsPrefs.getFileNamingRule(this)),
                    summary = getString(R.string.settings_file_naming_summary),
                ),
                SubSettingsItem.Switch(
                    id = ITEM_WRITE_COVER,
                    title = getString(R.string.settings_write_cover),
                    checked = SettingsPrefs.isWriteCoverEnabled(this),
                    summary = getString(R.string.settings_write_cover_summary),
                ),
                SubSettingsItem.Switch(
                    id = ITEM_WRITE_TAGS,
                    title = getString(R.string.settings_write_tag),
                    checked = SettingsPrefs.isWriteTagsEnabled(this),
                    summary = getString(R.string.settings_write_tags_summary),
                ),
                SubSettingsItem.Switch(
                    id = ITEM_WRITE_LYRICS,
                    title = getString(R.string.settings_write_lyric),
                    checked = SettingsPrefs.isWriteLyricsEnabled(this),
                    summary = getString(R.string.settings_write_lyrics_summary),
                ),
            ),
        ),
    )

    override fun onSettingsItemClick(item: SubSettingsItem) {
        when (item.id) {
            ITEM_DOWNLOAD_LOCATION -> checkStoragePermission()
            ITEM_FILE_NAMING_RULE -> showFileNamingRulePicker()
        }
    }

    override fun onSettingsSwitchChanged(item: SubSettingsItem.Switch, checked: Boolean) {
        when (item.id) {
            ITEM_WRITE_COVER -> SettingsPrefs.setWriteCoverEnabled(this, checked)
            ITEM_WRITE_TAGS -> SettingsPrefs.setWriteTagsEnabled(this, checked)
            ITEM_WRITE_LYRICS -> SettingsPrefs.setWriteLyricsEnabled(this, checked)
            else -> return
        }
        refreshSettings()
    }

    private fun showFileNamingRulePicker() {
        lifecycleScope.launch {
            val current = SettingsPrefs.getFileNamingRule(this@DownloadSettingsActivity)
            val picked = showSettingsOptionPicker(
                context = this@DownloadSettingsActivity,
                title = getString(R.string.settings_file_naming_title),
                options = listOf(
                    SettingsOption("title_artist", getString(R.string.settings_naming_title_artist)),
                    SettingsOption("artist_title", getString(R.string.settings_naming_artist_title)),
                ),
                selectedIndex = when (current) {
                    SettingsPrefs.FileNamingRule.TitleDashArtist -> 0
                    SettingsPrefs.FileNamingRule.ArtistDashTitle -> 1
                },
            )
            val rule = when (picked?.id) {
                "title_artist" -> SettingsPrefs.FileNamingRule.TitleDashArtist
                "artist_title" -> SettingsPrefs.FileNamingRule.ArtistDashTitle
                else -> return@launch
            }
            SettingsPrefs.setFileNamingRule(this@DownloadSettingsActivity, rule)
            refreshSettings()
        }
    }

    private fun checkStoragePermission() {
        val permissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            arrayOf(
                Manifest.permission.READ_MEDIA_AUDIO,
                Manifest.permission.READ_MEDIA_IMAGES,
                Manifest.permission.READ_MEDIA_VIDEO,
            )
        } else {
            arrayOf(
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.WRITE_EXTERNAL_STORAGE,
            )
        }
        when {
            permissions.all { permission ->
                ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
            } -> showDirectoryPicker()
            permissions.any { permission ->
                ActivityCompat.shouldShowRequestPermissionRationale(this, permission)
            } -> showPermissionRationaleDialog(permissions)
            else -> requestPermissionLauncher.launch(permissions)
        }
    }

    private fun showDirectoryPicker() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
            putExtra(
                "android.provider.extra.INITIAL_URI",
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).toUri(),
            )
        }
        directoryPickerLauncher.launch(intent)
    }

    private fun showPermissionRationaleDialog(permissions: Array<String>) {
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.storage_permission_required)
            .setMessage(R.string.storage_permission_rationale)
            .setPositiveButton(R.string.settings_grant_permission) { _, _ -> requestPermissionLauncher.launch(permissions) }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun showPermissionDeniedMessage() {
        Snackbar.make(
            findViewById(android.R.id.content),
            R.string.storage_permission_denied,
            Snackbar.LENGTH_LONG,
        ).setAction(R.string.settings_open_settings) { openAppSettings() }.show()
    }

    private fun openAppSettings() {
        startActivity(
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", packageName, null)
            },
        )
    }

    private fun saveDownloadPath(uri: Uri) {
        val path = getPathFromUri(uri)
        DownloadPathManager.setDownloadPath(this, path)
        DownloadPathManager.createDownloadDirectory(path)
        refreshSettings()
    }

    private fun getPathFromUri(uri: Uri): String {
        val docFile = DocumentFile.fromTreeUri(this, uri)
        if (docFile?.exists() != true) return DownloadPathManager.getDefaultPath()
        return uri.path?.replace("/tree/primary:", "/storage/emulated/0/")
            ?: DownloadPathManager.getDefaultPath()
    }

    private fun fileNamingRuleSummary(rule: SettingsPrefs.FileNamingRule): String = when (rule) {
        SettingsPrefs.FileNamingRule.TitleDashArtist -> getString(R.string.settings_naming_title_artist)
        SettingsPrefs.FileNamingRule.ArtistDashTitle -> getString(R.string.settings_naming_artist_title_default)
    }

    companion object {
        private const val ITEM_DOWNLOAD_LOCATION = "download_location"
        private const val ITEM_FILE_NAMING_RULE = "file_naming_rule"
        private const val ITEM_WRITE_COVER = "write_cover"
        private const val ITEM_WRITE_TAGS = "write_tags"
        private const val ITEM_WRITE_LYRICS = "write_lyrics"

        fun start(context: Context) {
            context.startActivity(Intent(context, DownloadSettingsActivity::class.java))
            AppActivityTransitions.applyForward(context)
        }
    }
}
