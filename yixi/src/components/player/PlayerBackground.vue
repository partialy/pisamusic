<template>
  <div class="player-background" aria-hidden="true">
    <Transition name="background-mode" mode="out-in">
      <div :key="config.mode" class="background-layer">
        <div v-if="config.mode === 'image'" class="image-background" :style="imageStyle" />
        <AnimatedPlayerBackground v-else :mode="config.mode" :config="config" :album="album" :playing="playing" :style="dynamicStyle" />
        <div v-if="config.mode !== 'flow'" class="background-mask" :style="{opacity: mask / 100}" />
      </div>
    </Transition>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import type { PlayerBackgroundConfig } from '@/playerBackground/backgroundConfig';
import AnimatedPlayerBackground from '@/playerBackground/AnimatedPlayerBackground.vue';
const props=defineProps<{config:PlayerBackgroundConfig;album:string;playing:boolean}>();
const mask=computed(()=>props.config.mode==='image'?props.config.image.mask:props.config.dynamic.mask);
const imageStyle=computed(()=>({
  backgroundImage:props.config.image.url?`url(${JSON.stringify(props.config.image.url)})`:'none',
  filter:`blur(${props.config.image.blur*.4}px) brightness(${props.config.image.brightness/100})`,
  transform:props.config.image.blur>0?'scale(1.08)':'none',
}));
const dynamicStyle=computed(()=>props.config.mode==='dynamic'?{filter:`brightness(${props.config.dynamic.brightness/100})`}:{});
</script>
<style scoped>
.player-background{position:absolute;inset:0;z-index:98;overflow:hidden;pointer-events:none;background:#081426;}
.background-layer,.image-background,.background-mask{position:absolute;inset:0;}
.image-background{background-position:center;background-size:cover;background-repeat:no-repeat;}
.background-mask{background:#000;}
.background-mode-enter-active,.background-mode-leave-active{transition:opacity .25s ease;}
.background-mode-enter-from,.background-mode-leave-to{opacity:0;}
@media(prefers-reduced-motion:reduce){.background-mode-enter-active,.background-mode-leave-active{transition:none;}}
</style>
