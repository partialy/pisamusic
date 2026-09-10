package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.*
import androidx.activity.addCallback
import androidx.core.widget.doAfterTextChanged
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.ui.dialog.PmMinimalDialog
import cn.partialy.pm.ui.mine.*
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.*
import javax.inject.Inject

@AndroidEntryPoint
class LocalPlaylistSongManagementActivity : BaseActivity() {
    @Inject lateinit var manager: PlaylistCollectionManager
    private lateinit var playlistId: String
    private lateinit var adapter: LocalPlaylistSongManagementAdapter
    private var source = emptyList<SongInfo>(); private var filtered = emptyList<SongInfo>()
    private val selected = linkedSetOf<String>(); private var shown = 40; private var job: Job? = null
    private lateinit var counter: TextView

    override fun onCreate(state: Bundle?) { super.onCreate(state); playlistId = intent.getStringExtra(ID).orEmpty(); if (playlistId.isBlank()) { finish(); return }
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(12, 24, 12, 0) }
        val bar = LinearLayout(this).apply { gravity = android.view.Gravity.CENTER_VERTICAL }
        val back = Button(this).apply { text = "‹"; setOnClickListener { finish() } }; bar.addView(back, LinearLayout.LayoutParams(56,56))
        val title = TextView(this).apply { text = intent.getStringExtra(TITLE).orEmpty(); textSize = 20f }; bar.addView(title, LinearLayout.LayoutParams(0,56,1f))
        counter = TextView(this); bar.addView(counter); root.addView(bar)
        val search = EditText(this).apply { hint = getString(R.string.local_playlist_management_search_hint); singleLine = true; doAfterTextChanged { schedule(it?.toString().orEmpty()) } }; root.addView(search, LinearLayout.LayoutParams(-1,56))
        adapter = LocalPlaylistSongManagementAdapter { song, checked -> if (checked) selected.add(key(song)) else selected.remove(key(song)); render() }
        val list = RecyclerView(this).apply { layoutManager = LinearLayoutManager(this@LocalPlaylistSongManagementActivity); adapter = this@LocalPlaylistSongManagementActivity.adapter; addOnScrollListener(object: RecyclerView.OnScrollListener(){ override fun onScrolled(v: RecyclerView,dx:Int,dy:Int){ if(dy>0 && (layoutManager as LinearLayoutManager).findLastVisibleItemPosition() >= adapter.itemCount-8){ shown += 40; render() } } }) }; root.addView(list, LinearLayout.LayoutParams(-1,0,1f))
        val actions = LinearLayout(this).apply { gravity = android.view.Gravity.CENTER }
        fun action(text:String, click:()->Unit)=Button(this).apply{text=text;setOnClickListener{click()};actions.addView(this,LinearLayout.LayoutParams(0,64,1f))}
        action("全选") { selected.addAll(filtered.map(::key)); render() }; action("反选") { filtered.forEach { val k=key(it); if(!selected.add(k)) selected.remove(k) }; render() }; action("删除") { deleteSelected() }; root.addView(actions)
        setContentView(root); onBackPressedDispatcher.addCallback(this){finish()}
        lifecycleScope.launch { source = withContext(Dispatchers.IO){ manager.getLocalPlaylistSongs(playlistId) }; selected.retainAll(source.mapTo(mutableSetOf(),::key)); schedule("") }
    }
    private fun schedule(q:String){ job?.cancel(); val snap=source; job=lifecycleScope.launch{delay(150); filtered=withContext(Dispatchers.Default){filterPlaylistSongs(snap,q)};shown=40;render()} }
    private fun render(){ adapter.submit(playlistSongWindow(filtered,shown),selected); counter.text=getString(R.string.local_playlist_management_selection_count,selected.size,source.size) }
    private fun deleteSelected(){ val songs=resolveSelectedPlaylistSongs(source,selected); if(songs.isEmpty())return; PmMinimalDialog.show(context=this,title=getString(R.string.mine_playlist_delete_confirm_title),message="删除已选 ${songs.size} 首歌曲？",cancelText=getString(R.string.cancel),confirmText=getString(R.string.dialog_ok),onConfirm={ manager.removeSongsFromLocalPlaylist(playlistId,songs.map{it.id}); selected.clear(); lifecycleScope.launch{source=withContext(Dispatchers.IO){manager.getLocalPlaylistSongs(playlistId)};render()} }) }
    private fun key(s:SongInfo)=playlistSongKey(s)
    companion object { private const val ID="playlist_id"; private const val TITLE="playlist_title"; fun start(c:Context,id:String,title:String){ c.startActivity(Intent(c,LocalPlaylistSongManagementActivity::class.java).putExtra(ID,id).putExtra(TITLE,title)) } }
}
