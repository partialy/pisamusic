package cn.partialy.pm.activity.setting

import android.os.Bundle
import androidx.activity.OnBackPressedCallback
import androidx.core.view.updatePadding
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityPlainTextContentBinding
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars

abstract class BaseSettingPlainTextActivity : BaseActivity() {

    protected lateinit var binding: ActivityPlainTextContentBinding

    protected abstract fun headerTitle(): String

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityPlainTextContentBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        enableEdgeToEdgeSystemBars(lightStatusBarIcons = true, lightNavigationBarIcons = true)
        binding.plainTextContentRoot.applySystemBarsInsets { insets ->
            binding.statusBarSpacer.layoutParams = binding.statusBarSpacer.layoutParams.apply {
                height = insets.top
            }
            binding.plainTextScrollView.updatePadding(bottom = 24 + insets.bottom)
        }

        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.title = headerTitle()
        binding.toolbar.setNavigationOnClickListener { finish() }
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() = finish()
            },
        )
    }

    protected fun setPlainText(title: String, content: String) {
        supportActionBar?.title = title.ifBlank { headerTitle() }
        binding.plainTextContent.text = content
    }

    protected fun showPlainTextError(message: String) {
        binding.plainTextContent.text = message
    }
}
