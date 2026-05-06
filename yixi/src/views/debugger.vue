<template>
  <!-- <div class="debugger" @click="click">
    <ProgressPanel style="width: 300px;" />
    <n-icon :size="28" :component="ListScrollIcon"></n-icon>
    <n-icon :size="28" :component="ListRandomIcon"></n-icon>
    <n-icon :size="28" :component="ListRepeatOffIcon"></n-icon>
    <n-icon :size="28" :component="ListRepeatOneIcon"></n-icon>

    <div @contextmenu.prevent="rightClick">右键测试
      <ContextMenu :visible="show" :items="items" ref="contextMenu" />
    </div>
  </div> -->
  <div>
    <button @click="click">open</button>
  </div>
  <!-- <div style="width: 600px;height: 400px;background-color: #afafaf;overflow: hidden;">
    <AMLyric></AMLyric>
  </div> -->
  <div>
    <iframe src="../../web/lyric-window.html" frameborder="0" width="600px" height="100px"></iframe>
  </div>
</template>

<script setup lang="ts">
import { useLyricStore } from '@/store';
import electronAPI from '@/utils/electron';

// import { NIcon } from "naive-ui";
// import { ProgressPanel } from "../components/player";
// import { ListRandomIcon, ListRepeatOffIcon, ListRepeatOneIcon, ListScrollIcon } from "@/icons";
// import { ContextMenu, type CustomMenuItem } from "@/components";
// import { ref, h, useTemplateRef } from 'vue';
// import { ArrowBack } from "@vicons/ionicons5";
import { storeToRefs } from 'pinia';
// const show = ref(false);
// const contextMenu = useTemplateRef("contextMenu");

// const items: CustomMenuItem[] = [{
//   label: 'test',
//   action: () => {
//     console.log('test');
//   },
//   icon: () => h(ArrowBack)
// },{
//   label: 'test2',
//   action: () => {
//     console.log('test2');
//   },
//   icon: () => h(ArrowBack),
//   disabled: true
// },{
//   label: 'test3',
//   action: () => {
//     console.log('test3');
//   },
//   icon: () => h(ArrowBack)
// }]
// const rightClick = async (e: MouseEvent) => {
//   show.value = true;
//   // const { x, y } = { x: e.clientX, y: e.clientY };
//   // contextMenu.value?.show(x, y)
// };

const click = async () => {
  await electronAPI.openLyricWindow();
  const {AMKrc, AMLrc} = storeToRefs(useLyricStore());
  console.log("send")
  await electronAPI.setLyrics({
    type: "krc",
    data: JSON.stringify(AMLrc.value),
  });
  await electronAPI.setLyrics({
    type: "lrc",
    data: JSON.stringify(AMKrc.value),
  });
};
</script>

<style lang="scss" scoped>
.debugger {
  height: 500px;
  width: 100%;
  // background: url("../assets/images/song.jpg") no-repeat;
}
</style>
