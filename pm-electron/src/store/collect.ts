import type { Song, CommonPlaylist } from "@/types/song";
import electronAPI from "@/utils/electron";
import { defineStore } from "pinia";
import { watch } from "vue";

export const useCollectStore = defineStore("collect", {
  state: () => ({
    songMap: new Map<string, Song>(),
    playlistMap: new Map<string, CommonPlaylist>(),
    changed: false,

    get songs() {
      return Array.from(this.songMap.values());
    },
    get playlists() {
      return Array.from(this.playlistMap.values());
    },
  }),
  actions: {
    async initStore() {
      const sres = await electronAPI.readFile({
        filename: "songs.json",
        folder: "collect",
      });
      const pres = await electronAPI.readFile({
        filename: "playlists.json",
        folder: "collect",
      });
      if (!sres.success || !pres.success) {
        window.$notification.error({
          title: "读取收藏数据失败",
          content: "playlists:" + pres.error + "\nsongs:" + sres.error,
          duration: 5000,
        });
        this.songMap = new Map<string, Song>();
        this.playlistMap = new Map<string, CommonPlaylist>();
      } else {
        const songs = JSON.parse(sres.data) as Song[];
        const playlists = JSON.parse(pres.data) as CommonPlaylist[];
        this.songMap = new Map(songs.map((s) => [s.id, s]));
        this.playlistMap = new Map(playlists.map((s) => [s.id, s]));
      }

      watch(
        [() => this.songMap, () => this.playlistMap],
        async () => {
          this.changed = true;
        },
        { deep: true }
      );
    },

    async save() {
      const songs = Array.from(this.songMap.values());
      const playlists = Array.from(this.playlistMap.values());
      await Promise.all([
        electronAPI.writeFile({
          filename: "songs.json",
          folder: "collect",
          data: JSON.stringify(songs),
        }),
        electronAPI.writeFile({
          filename: "playlists.json",
          folder: "collect",
          data: JSON.stringify(playlists),
        }),
      ]);
      this.changed = false;
    },
    async collectSong(song?: Song) {
      if(!song) return;
      if (this.containsSong(song)) {
        this.songMap.delete(song.id);
        window.$message.success("已取消收藏");
      } else {
        this.songMap.set(song.id, song);
        window.$message.success("已添加到收藏");
      }
    },
    async collectList(playlist?: CommonPlaylist) {
      if(!playlist) return;
      if (this.containsPlaylist(playlist)) {
        this.playlistMap.delete(playlist.id);
        window.$message.success("已取消收藏");
      } else {
        this.playlistMap.set(playlist.id, playlist);
        window.$message.success("已添加到收藏");
      }
    },

    containsSong(song?: Song) {
      if(!song) return false;
      return this.songMap.has(song.id);
    },
    containSongById(id: string) {
      return this.songMap.has(id);
    },
    containsPlaylist(playlist?: CommonPlaylist) {
      if(!playlist) return false;
      return this.songMap.has(playlist.id);
    },
    containPlaylistById(id: string) {
      return this.playlistMap.has(id);
    },
  },
});

export default useCollectStore;
