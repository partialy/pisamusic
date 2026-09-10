package cn.partialy.pm.ui.mine
import android.graphics.Color
import android.view.*
import android.widget.*
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.model.SongInfo
class LocalPlaylistSongManagementAdapter(private val onChange:(SongInfo,Boolean)->Unit):RecyclerView.Adapter<LocalPlaylistSongManagementAdapter.VH>(){
 private var items=emptyList<SongInfo>();private var selected=setOf<String>()
 fun submit(i:List<SongInfo>,s:Set<String>){items=i;selected=s;notifyDataSetChanged()}
 override fun onCreateViewHolder(p:ViewGroup,v:Int)=VH(LinearLayout(p.context).apply{orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL;padding=8},onChange)
 override fun onBindViewHolder(h:VH,pos:Int){h.bind(items[pos],playlistSongKey(items[pos]) in selected)};override fun getItemCount()=items.size
 class VH(private val row:LinearLayout,private val cb:(SongInfo,Boolean)->Unit):RecyclerView.ViewHolder(row){fun bind(s:SongInfo,checked:Boolean){row.removeAllViews();val box=CheckBox(row.context);box.isChecked=checked;row.addView(box);val t=TextView(row.context).apply{text="${s.name}\n${s.artist}";textSize=16f;setTextColor(Color.BLACK)};row.addView(t,LinearLayout.LayoutParams(0,64,1f));box.setOnCheckedChangeListener{_,v->cb(s,v)};row.setOnClickListener{box.isChecked=!box.isChecked}}}
}
