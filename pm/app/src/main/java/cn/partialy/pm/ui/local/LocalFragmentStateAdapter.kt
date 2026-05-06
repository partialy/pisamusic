package cn.partialy.pm.ui.local

import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import androidx.viewpager2.adapter.FragmentStateAdapter
import cn.partialy.pm.ui.local.fragments.DownloadedMusicFragment
import cn.partialy.pm.ui.local.fragments.LocalMusicFragment

class LocalFragmentStateAdapter(fragmentActivity: FragmentActivity) : FragmentStateAdapter(fragmentActivity) {
    override fun getItemCount(): Int {
        return 2
    }

    override fun createFragment(position: Int): Fragment {
        return when (position) {
            0 -> LocalMusicFragment()
            1 -> DownloadedMusicFragment()
            else -> throw IllegalArgumentException("Invalid position: $position")
        }
    }
}