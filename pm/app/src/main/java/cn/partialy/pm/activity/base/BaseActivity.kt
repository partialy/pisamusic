package cn.partialy.pm.activity.base

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import cn.partialy.pm.player.MusicController
import cn.partialy.pm.utils.loveUtil.LoveManager
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
open class BaseActivity : AppCompatActivity() {

    @Inject
    lateinit var loveManager: LoveManager

    @Inject
    lateinit var musicController: MusicController

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
    }
}
