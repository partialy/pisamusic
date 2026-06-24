package cn.partialy.pm.activity

import android.os.Bundle
import androidx.recyclerview.widget.LinearLayoutManager
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivitySubSettingsBinding
import cn.partialy.pm.ui.settings.SubSettingsAdapter
import cn.partialy.pm.ui.settings.SubSettingsItem
import cn.partialy.pm.ui.settings.SubSettingsSection

abstract class SubSettingsActivity : BaseActivity() {
    private lateinit var binding: ActivitySubSettingsBinding
    private lateinit var settingsAdapter: SubSettingsAdapter

    protected abstract val settingsPageTitle: CharSequence

    protected abstract fun createSettingsSections(): List<SubSettingsSection>

    protected open fun onSettingsItemClick(item: SubSettingsItem) = Unit

    protected open fun onSettingsSwitchChanged(item: SubSettingsItem.Switch, checked: Boolean) = Unit

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivitySubSettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowTitleEnabled(true)
        binding.toolbar.title = settingsPageTitle
        binding.toolbar.setNavigationOnClickListener { finish() }

        settingsAdapter = SubSettingsAdapter(
            onItemClick = ::onSettingsItemClick,
            onSwitchChanged = ::onSettingsSwitchChanged,
        )
        binding.settingsList.apply {
            layoutManager = LinearLayoutManager(this@SubSettingsActivity)
            adapter = settingsAdapter
            itemAnimator = null
        }
        refreshSettings()
    }

    override fun onResume() {
        super.onResume()
        if (::settingsAdapter.isInitialized) refreshSettings()
    }

    protected fun refreshSettings() {
        settingsAdapter.submitList(createSettingsSections())
    }
}
