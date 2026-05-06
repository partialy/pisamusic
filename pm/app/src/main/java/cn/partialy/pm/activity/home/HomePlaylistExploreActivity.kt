package cn.partialy.pm.activity.home

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.widget.GridLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.viewModels
import androidx.core.content.ContextCompat
import androidx.core.view.updateLayoutParams
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.activity.LocalMusicActivity
import cn.partialy.pm.activity.LocalMusicActivity.Companion.EXTRA_INITIAL_TAB
import cn.partialy.pm.activity.LocalMusicActivity.Companion.TAB_DOWNLOADED
import cn.partialy.pm.activity.LocalMusicActivity.Companion.TAB_LOCAL
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityHomePlaylistExploreBinding
import cn.partialy.pm.ui.home.viewModels.HomePlaylistExploreViewModel
import cn.partialy.pm.ui.home.viewModels.PlaylistChildTagUi
import cn.partialy.pm.ui.home.viewModels.PlaylistParentTagUi
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

@AndroidEntryPoint
class HomePlaylistExploreActivity : BaseActivity() {

    private lateinit var binding: ActivityHomePlaylistExploreBinding
    private val viewModel: HomePlaylistExploreViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityHomePlaylistExploreBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        enableEdgeToEdgeSystemBars(lightStatusBarIcons = true, lightNavigationBarIcons = true)
        setupInsets()
        setupHeader()
        observeViewModel()
        viewModel.loadInitial()
    }

    private fun setupInsets() {
        binding.root.applySystemBarsInsets { insets ->
            binding.statusBarSpacer.updateLayoutParams { height = insets.top }
            binding.categoryScrollView.setPadding(
                binding.categoryScrollView.paddingLeft,
                binding.categoryScrollView.paddingTop,
                binding.categoryScrollView.paddingRight,
                insets.bottom + dp(20),
            )
        }
    }

    private fun setupHeader() {
        binding.backButton.setOnClickListener { finish() }
    }

    private fun observeViewModel() {
        lifecycleScope.launch {
            viewModel.parentTags.collectLatest { list ->
                renderAllSections(list)
            }
        }
        lifecycleScope.launch {
            viewModel.isLoading.collectLatest { loading ->
                binding.progressBar.visibility = if (loading) android.view.View.VISIBLE else android.view.View.GONE
            }
        }
    }

    private fun renderAllSections(tags: List<PlaylistParentTagUi>) {
        binding.categorySectionContainer.removeAllViews()
        tags.forEach { parent ->
            if (parent.children.isEmpty()) return@forEach
            val title = TextView(this).apply {
                text = parent.name
                textSize = 20f
                setTextColor(ContextCompat.getColor(this@HomePlaylistExploreActivity, R.color.home_tab_selected))
                setTypeface(typeface, android.graphics.Typeface.BOLD)
            }
            val titleLp = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply {
                topMargin = dp(12)
                bottomMargin = dp(8)
            }
            binding.categorySectionContainer.addView(title, titleLp)

            val grid = GridLayout(this).apply {
                columnCount = 3
            }
            parent.children.forEach { child ->
                grid.addView(buildGridTagView(child))
            }
            binding.categorySectionContainer.addView(grid)
        }
    }

    private fun buildGridTagView(item: PlaylistChildTagUi): TextView {
        val tv = TextView(this)
        tv.text = item.name
        tv.textSize = 14f
        tv.gravity = Gravity.CENTER
        tv.setPadding(dp(8), dp(10), dp(8), dp(10))
        tv.setOnClickListener {
            HomePlaylistListActivity.start(
                context = this,
                categoryId = item.id,
                categoryName = item.name,
            )
        }
        val lp = GridLayout.LayoutParams().apply {
            width = 0
            height = GridLayout.LayoutParams.WRAP_CONTENT
            rowSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f)
            columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f)
            setMargins(0, 0, dp(10), dp(10))
        }
        tv.layoutParams = lp
        val bg = GradientDrawable().apply {
            cornerRadius = dp(16).toFloat()
            setColor(ContextCompat.getColor(this@HomePlaylistExploreActivity, R.color.white_black_bg))
            setStroke(dp(1), ContextCompat.getColor(this@HomePlaylistExploreActivity, R.color.search_history_chip_stroke))
        }
        tv.background = bg
        tv.setTextColor(ContextCompat.getColor(this, R.color.home_tab_selected))
        return tv
    }

    override fun finish() {
        super.finish()
        overridePendingTransition(R.anim.playlist_previous_scale_from_95, R.anim.slide_to_right)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    companion object {
        fun start(context: Context) {
            val intent = Intent(context, HomePlaylistExploreActivity::class.java)
            context.startActivity(intent)
            (context as? Activity)?.overridePendingTransition(
                R.anim.slide_to_left,
                R.anim.dim_and_scale_out,
            )
        }
    }
}
