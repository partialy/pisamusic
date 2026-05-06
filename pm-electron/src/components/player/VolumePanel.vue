<template>
    <div class="volume-pannel">
        <div class="volume-bar">
            <n-slider class="volume" vertical v-model:value="volume" :max="1" :min="0" :step="0.01" :tooltip="false" />
        </div>
        <div class="volume-text">
            {{ volumeText }}%
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { NSlider } from 'naive-ui';
import { useAudioStore } from '@/store';
const playerStore = useAudioStore()
const { volume } = storeToRefs(playerStore)

const volumeText = computed(() => {
    return Math.round(volume.value * 100)
})

</script>

<style lang="scss" scoped>
.volume-pannel {
    border-radius: 10px;
    width: 100%;
    height: 100%;
    background-color: var(--color-bg-default);
    box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.1);


    .volume-bar {
        padding: 10px;
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 80%;
    }

    .volume-text {
        width: 100%;
        height: 20%;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 14px;
        color: var(--color-text-default);
    }
}

:deep(.n-slider-rail) {
    height: 100% !important;
}

</style>
