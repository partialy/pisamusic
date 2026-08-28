package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import androidx.activity.addCallback
import androidx.core.view.updatePadding
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityCloudMusicSubmissionBinding
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import dagger.hilt.android.AndroidEntryPoint

/** 网盘投稿入口；完整上传和草稿流程由后续任务接入。 */
@AndroidEntryPoint
class CloudMusicSubmissionActivity : BaseActivity() {

    private lateinit var binding: ActivityCloudMusicSubmissionBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityCloudMusicSubmissionBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)
        setupSystemBars()
        onBackPressedDispatcher.addCallback(this) { finishAnimated() }
        binding.cloudMusicSubmissionToolbar.setNavigationOnClickListener { finishAnimated() }
    }

    private fun finishAnimated() {
        finish()
        AppActivityTransitions.applyBack(this)
    }

    private fun setupSystemBars() {
        val isNight = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(
            lightStatusBarIcons = !isNight,
            lightNavigationBarIcons = !isNight,
        )
        binding.cloudMusicSubmissionRoot.applySystemBarsInsets { insets ->
            binding.statusBarSpacer.layoutParams = binding.statusBarSpacer.layoutParams.apply {
                height = insets.top
            }
            binding.cloudMusicSubmissionContent.updatePadding(bottom = insets.bottom)
        }
    }

    companion object {
        fun start(context: Context) {
            context.startActivity(Intent(context, CloudMusicSubmissionActivity::class.java))
            AppActivityTransitions.applyForward(context)
        }
    }
}
