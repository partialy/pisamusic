<template>
  <div ref="host" class="animated-background"><canvas v-if="mode === 'flow'" ref="canvas" /></div>
</template>
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { BackgroundRender, EplorRenderer, type AbstractBaseRenderer } from '@applemusic-like-lyrics/core';
import type { PlayerBackgroundConfig } from './backgroundConfig';
import { CoverFlowRenderer } from './CoverFlowRenderer';
import { extractFlowPalette, loadCoverImage } from './flowPalette';
const props=defineProps<{mode:'flow'|'dynamic';config:PlayerBackgroundConfig;album:string;playing:boolean}>();
const host=ref<HTMLDivElement>();const canvas=ref<HTMLCanvasElement>();
let flow:CoverFlowRenderer|undefined, dynamic:AbstractBaseRenderer|undefined;
let generation=0,disposed=false,observer:ResizeObserver|undefined;
let width=1,height=1;
let running=false;
let settleTimer:ReturnType<typeof setTimeout>|undefined;
let coverRequest:AbortController|undefined;
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
function eligible(){const options=props.config[props.mode];return props.config.mode===props.mode&&!document.hidden&&!reduced.matches&&(props.playing||options.continueWhenPaused);}
function resize(){
  if(!host.value)return;
  const rect=host.value.getBoundingClientRect();width=rect.width;height=rect.height;
  flow?.resize(width,height,window.devicePixelRatio||1);
  drawDynamicOnce();
}
function updateRunning(){
  running=eligible();flow?.setRunning(running);
  cancelStaticDraw();
  if(!dynamic)return;
  if(running) {dynamic.setStaticMode(false);dynamic.resume();}
  else dynamic.pause();
}
function cancelStaticDraw(){
  clearTimeout(settleTimer);settleTimer=undefined;
  dynamic?.setFlowSpeed(props.config.dynamic.speed);
  dynamic?.setFPS(props.config.dynamic.fps);
}
function drawDynamicOnce(){
  if(!dynamic||document.hidden||running||disposed||props.config.mode!==props.mode)return;
  cancelStaticDraw();
  const renderer=dynamic;
  // AML 新纹理约需 200ms 才完全显现；冻结轨迹，给透明度有限的收敛时间。
  renderer.setStaticMode(true);renderer.setFlowSpeed(0);renderer.setFPS(120);renderer.resume();
  settleTimer=setTimeout(()=>{
    settleTimer=undefined;
    if(dynamic===renderer&&!running&&!disposed){renderer.pause();renderer.setFlowSpeed(props.config.dynamic.speed);renderer.setFPS(props.config.dynamic.fps);}
  },350);
}
function applyConfig(){
  flow?.setOptions(props.config.flow);
  if(dynamic){const value=props.config.dynamic;dynamic.setFlowSpeed(value.speed);dynamic.setFPS(value.fps);dynamic.setRenderScale(value.scale);}
  updateRunning();drawDynamicOnce();
}
async function updateAlbum(){
  const request=++generation; coverRequest?.abort(); coverRequest=new AbortController();
  const signal=coverRequest.signal;
  if(props.mode==='flow'){
    const palette=await extractFlowPalette(props.album,signal);
    if(!disposed&&request===generation)flow?.setPalette(palette);
    return;
  }
  let candidate:AbstractBaseRenderer|undefined;
  try{
    const image=await loadCoverImage(props.album,signal);
    if(disposed||request!==generation)return;
    candidate=BackgroundRender.new(EplorRenderer);
    candidate.pause();
    const options=props.config.dynamic;
    candidate.setFPS(options.fps);candidate.setFlowSpeed(options.speed);candidate.setRenderScale(options.scale);
    await candidate.setAlbum(image);
    if(disposed||request!==generation){candidate.dispose();return;}
    const element=candidate.getElement();element.style.width='100%';element.style.height='100%';
    cancelStaticDraw();dynamic?.dispose();host.value?.replaceChildren(element);dynamic=candidate;
    applyConfig();
  }catch{candidate?.dispose();}
}
function refreshVisibility(){updateRunning();drawDynamicOnce();}
onMounted(()=>{
  if(canvas.value){try{flow=new CoverFlowRenderer(canvas.value,props.config.flow);}catch{ /* 保留容器的静态底色。 */ }}
  observer=new ResizeObserver(resize);if(host.value)observer.observe(host.value);
  window.addEventListener('resize',resize);document.addEventListener('visibilitychange',refreshVisibility);reduced.addEventListener('change',refreshVisibility);
  resize();updateRunning();void updateAlbum();
});
watch(()=>props.album,()=>{void updateAlbum();});
watch(()=>props.config,applyConfig,{deep:true});watch(()=>props.playing,updateRunning);
onBeforeUnmount(()=>{
  disposed=true;generation++;coverRequest?.abort();observer?.disconnect();cancelStaticDraw();flow?.dispose();dynamic?.dispose();
  window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',refreshVisibility);reduced.removeEventListener('change',refreshVisibility);
});
</script>
<style scoped>
.animated-background,canvas{position:absolute;inset:0;width:100%;height:100%;}
</style>
