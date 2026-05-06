package cn.partialy.pm.ui.local.viewModels

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import cn.partialy.pm.model.SongInfo

sealed class LocalMusicState {
    object Loading : LocalMusicState()
    data class Success(val songs: List<SongInfo>) : LocalMusicState()
    data class Error(val message: String) : LocalMusicState()
}

class LocalMusicViewModel : ViewModel() {
    private val _state = MutableLiveData<LocalMusicState>()
    val state: LiveData<LocalMusicState> = _state

    private val _songInfos = MutableLiveData<List<SongInfo>>()
    val songInfos: LiveData<List<SongInfo>> = _songInfos

    fun setSongInfos(songInfos: List<SongInfo>) {
        _songInfos.value = songInfos
        _state.value = LocalMusicState.Success(songInfos)
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