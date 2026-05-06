import Header from "./Header.vue";
import ElectronOperation from "./ElectronOperation.vue";
import NotFound from "./404.vue";
import WelcomeCard from "./home/WelcomeCard.vue";
import PlayerBar from "./player/PlayerBar.vue";
import KGRecommendPlaylist from "./playList/KGRecommendPlaylist.vue";
import KGRecommendSong from "./playList/KGRecommendSong.vue";
import MainPlayer from "./player/MainPlayer.vue";
import AMLyric from "./player/AMLyric.vue";
import CommonLyric from "./player/CommonLyric.vue";
import ContextMenu from "./common/ContextMenu.vue";
import type { VNodeChild } from "vue";
import SongList from "./list/SongList.vue";
import PlaylistCollect from "./list/PlaylistCollect.vue";
import LoginCard from "./home/LoginCard.vue";
import DialogWrapper from "./common/DialogWrapper.vue";
export {
    Header,
    ElectronOperation,
    NotFound,
    WelcomeCard,
    PlayerBar,
    KGRecommendPlaylist,
    KGRecommendSong,
    MainPlayer,
    AMLyric,
    CommonLyric,
    ContextMenu,
    SongList,
    PlaylistCollect,
    LoginCard,
    DialogWrapper
}

export * from "./player";
export * from "./playList";
export * from "./setting";
export * from "./search";

export type CustomMenuItem = {
  label: string
  icon?: () => VNodeChild
  action?: () => void
  disabled?: boolean
}