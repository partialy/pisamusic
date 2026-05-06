package cn.partialy.pm.ui.home

import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import androidx.viewpager2.adapter.FragmentStateAdapter
import cn.partialy.pm.ui.home.fragments.FavoriteSongsFragment
import cn.partialy.pm.ui.home.fragments.HomePlaylistSquareFragment
import cn.partialy.pm.ui.home.fragments.RecommendedSongsFragment

class HomeFragmentStateAdapter(fragmentActivity: FragmentActivity) : FragmentStateAdapter(fragmentActivity) {

    override fun getItemCount(): Int = 3

    override fun createFragment(position: Int): Fragment {
        return when (position) {
            0 -> RecommendedSongsFragment()
            1 -> FavoriteSongsFragment()
            2 -> HomePlaylistSquareFragment()
            else -> throw IllegalStateException("fragment索引有误: $position")
        }
    }
}
