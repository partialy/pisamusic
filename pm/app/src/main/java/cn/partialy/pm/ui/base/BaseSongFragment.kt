package cn.partialy.pm.ui.base

import android.os.Bundle
import android.view.View
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.player.MusicController
import cn.partialy.pm.utils.DownloadManager
import cn.partialy.pm.utils.loveUtil.LoveManager

/**
 * 歌曲列表的基类Fragment，封装了通用的逻辑
 */
abstract class BaseSongFragment : Fragment() {
    
    protected lateinit var musicController: MusicController
    protected lateinit var downloadManager: DownloadManager
    protected lateinit var adapter: RecyclerView.Adapter<*>
    protected lateinit var loveManager: LoveManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // 子类需要在 onCreate 中初始化 musicController和loveManager
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        downloadManager = DownloadManager.getInstance(requireContext().applicationContext)
        setupRecyclerView()
        observeViewModel()
    }

    /**
     * 设置RecyclerView
     */
    abstract fun setupRecyclerView()

    /**
     * 观察ViewModel中的数据变化
     */
    abstract fun observeViewModel()
}
