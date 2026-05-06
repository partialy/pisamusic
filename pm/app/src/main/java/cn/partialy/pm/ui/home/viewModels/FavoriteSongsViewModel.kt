package cn.partialy.pm.ui.home.viewModels

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.utils.loveUtil.LoveManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class FavoriteSongsViewModel @Inject constructor(
    private val loveManager: LoveManager
) : ViewModel() {
    private val _isLoading = MutableLiveData<Boolean>()
    val isLoading: LiveData<Boolean> = _isLoading

    private val _songs = MutableLiveData<List<SongInfo>>()
    val songs: LiveData<List<SongInfo>> = _songs

    init {
        viewModelScope.launch {
            loveManager.loveListFlow.collectLatest { list ->
                _songs.value = list
            }
        }
    }

    fun loadSongs() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                withContext(Dispatchers.IO) {
                    loveManager.getLoveList()
                }
            } finally {
                _isLoading.value = false
            }
        }
    }
}
