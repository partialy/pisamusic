package cn.partialy.pm.ui.local.viewModels

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import cn.partialy.pm.model.SongInfo

sealed class DownloadedMusicState {
    object Loading : DownloadedMusicState()
    data class Success(val songs: List<SongInfo>) : DownloadedMusicState()
    data class Error(val message: String) : DownloadedMusicState()
}

class DownloadedMusicViewModel: ViewModel() {
    private val _state = MutableLiveData<DownloadedMusicState>()
    val state: LiveData<DownloadedMusicState> = _state

    private val _songInfos = MutableLiveData<List<SongInfo>>()
    val songInfos: LiveData<List<SongInfo>> = _songInfos

    fun setSongInfos(songInfos: List<SongInfo>) {
        try {
            _songInfos.value = songInfos
            _state.value = DownloadedMusicState.Success(songInfos)
        }catch (e:Exception){
            println(e)
            _state.value = DownloadedMusicState.Error(e.message ?:"未知错误")
        }
    }

    fun getSongInfos(): List<SongInfo> {
        return _songInfos.value ?: emptyList()
    }

    fun getSongInfo(position: Int): SongInfo {
        return _songInfos.value?.get(position) ?: throw IllegalArgumentException("Invalid position")
    }

    fun getSongInfo(id: String): SongInfo {
        return _songInfos.value?.find { it.id == id } ?: throw IllegalArgumentException("Invalid id")
    }
}