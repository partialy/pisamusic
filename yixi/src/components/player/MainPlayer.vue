<template>
    <div class="player-layout" ref="playerLayout">
        <PlayerBackground :fps="60" :album="coverUrl"></PlayerBackground>
        <Transition name="header" mode="default">
            <div class="header-bar" v-show="isMouseActive">
                <div class="header-drag-region"></div>
                <div class="header-side">
                    <div class="header-btn" @click="commonStore.hidePlayer">
                        <ArrowDownIcon class="btn-icon" />
                    </div>
                </div>
                <div class="header-btns">
                    <div class="header-btn" @click="electronAPI.minimizeWindow">
                        <MiniWindowIcon class="btn-icon" />
                    </div>
                    <div class="header-btn" @click="commonStore.handleToggleFullscreen">
                        <RestoreIcon v-if="commonStore.isFullscreen" class="btn-icon" />
                        <ScaleIcon v-else class="btn-icon" />
                    </div>
                    <div class="header-btn" @click="commonStore.hidePlayer">
                        <CloseIcon class="btn-icon" />
                    </div>
                    <!-- <n-button class="header-btn" quaternary circle>
                    <n-icon size="24" color="#999" depth="2" :component="ScaleFullscreenIcon"></n-icon>
                </n-button>
                <n-button class="header-btn" quaternary circle @click="commonStore.hidePlayer">
                    <n-icon size="28" color="#999" depth="2" :component="CloseIcon"></n-icon>
                </n-button> -->
                </div>
            </div>
        </Transition>
        <div>
            <img :src="coverUrl || '/default-bg.jpg'" alt="" class="bg-cover" style="width: 100%;height: 100%;object-fit: cover;">
        </div>
        
        <div class="model-bg"></div>
        <!-- cover -->
        <div class="info-container" ref="infoContainer">
            <div class="cover" v-if="currentSong?.source != 'wy'">
                <n-progress type="circle" :show-indicator="false" :percentage="progress" processing :stroke-width="3"
                    style="z-index: 100;position: absolute;top: 0;left: 0;" />
                <div class="img-container">
                    <img :src="coverUrl || '/images/song.jpg'" alt=""
                        style="width: 100%;height: 100%;object-fit: cover;">
                </div>
            </div>
            <div class="wy-cover" v-else>
                <video autoplay loop class="video-cover" v-if="currentSong.d_cover" :src="currentSong.d_cover"></video>
                <n-image v-else class="video-cover" preview-disabled :src="currentSong.coverSize?.l || currentSong.cover"/>
            </div>
            <div class="info-content">
                <div class="info-title">
                    <span>{{ songName || '未播放' }}</span>
                </div>
                <div class="info-artist">

                    <span>{{ currentSong?.singer || '未知歌手' }}</span>
                </div>
                <div class="info-album">

                    <span>{{ currentSong?.album || '未知专辑' }}</span>
                </div>
                <div class="progress-bar">
                    <ProgressPanel />
                </div>
            </div>
        </div>
        <!-- 歌词 -->
        <AMLyric v-if="AMLyricView" ref="playerLyric" class="player-lyric" />
        <CommonLyric v-else-if="lyricStore.rawKrc || lyricStore.rawLrc" ref="playerLyric" class="player-lyric" />
        <!-- 控制面板 -->
        <Transition name="ctlp" mode="default">
            <ControlPanel class="control-panel" v-show="isMouseActive" />
        </Transition>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue';
import { NProgress } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { useAudioStore, useCommonStore, useLyricStore } from '@/store';
import { ControlPanel } from '.';
import { getKgImage } from '@/utils/common';
import { AMLyric, CommonLyric } from '.';
import { ArrowDownIcon, CloseIcon, MiniWindowIcon, RestoreIcon, ScaleIcon } from '@/icons';
import electronAPI from '@/utils/electron';
import ProgressPanel from './ProgressPanel.vue';
const playerStore = useAudioStore()
const { currentSong, progress } = storeToRefs(playerStore)
const commonStore = useCommonStore()
const lyricStore = useLyricStore()

const AMLyricView = computed(() => {
    return currentSong.value?.id && (lyricStore.rawKrc || lyricStore.rawLrc) && lyricStore.setting.useAMLyric
})

const coverUrl = computed(() => {
    if (currentSong.value?.cover) {
        return getKgImage(currentSong.value?.cover, 240)
    }
})

const songName = computed(() => {
    if (currentSong.value?.name && currentSong.value.name.includes(' - ')) {
        return currentSong.value?.name.split(' - ')[1]
    } else {
        return currentSong.value?.name
    }
})


const active = computed(() => {
    return playerStore.isPlaying ? 'running' : 'paused'
})

const playerLayout = ref<HTMLDivElement>()
const infoContainer = ref<HTMLDivElement>()
const setCoverBgPosition = async () => {
    if (!infoContainer.value) return
    if (currentSong.value?.id && (lyricStore.rawKrc || lyricStore.rawLrc)) {
        infoContainer.value.style.left = '25%'
    } else {
        infoContainer.value.style.left = '50%'
    }
}

const isMouseActive = ref(true);
const MOUSE_IDLE_MS = 3000;
let timeoutId: number | undefined;

const isPlayerHidden = () => {
    return playerLayout.value?.style.display === 'none';
};

const updateMouseActive = (active: boolean) => {
    if (isMouseActive.value === active) return;
    isMouseActive.value = active;
};

const clearMouseTimer = () => {
    if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
    }
};

const markMouseInactive = () => {
    clearMouseTimer();
    updateMouseActive(false);
};

const scheduleHide = () => {
    clearMouseTimer();
    if (isPlayerHidden()) {
        updateMouseActive(true);
        return;
    }
    timeoutId = window.setTimeout(() => {
        markMouseInactive();
    }, MOUSE_IDLE_MS);
};

const markMouseActive = () => {
    updateMouseActive(true);
    scheduleHide();
};

const handleDocumentMouseMove = () => {
    markMouseActive();
};

const handleDocumentMouseDown = () => {
    markMouseActive();
};

const handleDocumentKeyDown = () => {
    markMouseActive();
};

const handleWindowFocus = () => {
    markMouseActive();
};

const handleWindowBlur = () => {
    markMouseInactive();
};

const handleDocumentMouseOut = (event: MouseEvent) => {
    if (event.relatedTarget) return;
    markMouseInactive();
};

const initMouseListener = () => {
    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mousedown', handleDocumentMouseDown);
    document.addEventListener('keydown', handleDocumentKeyDown);
    document.addEventListener('mouseout', handleDocumentMouseOut);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);
};

watch(() => isMouseActive.value, (active) => {
    document.body.style.cursor = active ? 'default' : 'none';
}, { immediate: false });


onMounted(() => {
    setCoverBgPosition()
    markMouseActive();
    initMouseListener();
})

onBeforeUnmount(() => {
    document.removeEventListener('mousemove', handleDocumentMouseMove);
    document.removeEventListener('mousedown', handleDocumentMouseDown);
    document.removeEventListener('keydown', handleDocumentKeyDown);
    document.removeEventListener('mouseout', handleDocumentMouseOut);
    window.removeEventListener('focus', handleWindowFocus);
    window.removeEventListener('blur', handleWindowBlur);
    clearMouseTimer();
});
</script>

<style lang="scss" scoped>
@keyframes rotate {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}

@keyframes slide-out {
    from {
        transform: translateY(0);
    }

    to {
        transform: translateY(100%);
    }
}

@keyframes slide-in {
    0% {
        transform: translateY(100%);
    }

    100% {
        transform: translateY(0);
    }
}

@keyframes slide-down {
    from {
        transform: translateY(-100%);
    }

    to {
        transform: translateY(0);
    }
}

@keyframes slide-up {
    from {
        transform: translateY(0);
    }

    to {
        transform: translateY(-100%);
    }
}

.bg-cover {
    animation: rotate 30s linear infinite;
    animation-play-state: v-bind(active);
}

.header-enter-active {
    animation: slide-down 0.6s ease-in-out;
}

.header-leave-active {
    animation: slide-up 0.6s ease-in-out;
}

.ctlp-enter-active {
    animation: slide-in 0.6s ease-in-out;
}

.ctlp-leave-active {
    animation: slide-out 0.6s ease-in-out;
}

:deep(.n-progress) {
    svg {
        width: 320px;
        height: 320px;
    }
}

.model-bg {
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(80px) brightness(110%);
    -webkit-backdrop-filter: blur(80px) brightness(110%);
    position: fixed;
    top: 0;
    left: 0;
    z-index: 99;

    &::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(to bottom,
                rgba(255, 255, 255, 0.1) 0%,
                rgba(0, 0, 0, 0.1) 100%);
        pointer-events: none;
    }
}

.player-layout {
    width: 100vw;
    height: 100vh;
    background-color: var(--bg-color);
    overflow: hidden;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 100;

    .header-bar {
        width: 100vw;
        height: 60px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        background: transparent;
        position: fixed;
        top: 0;
        left: 0;
        z-index: 101;
        pointer-events: none;

        .header-drag-region {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 60px;
            -webkit-app-region: drag;
            pointer-events: auto;
        }

        .header-side,
        .header-btns {
            pointer-events: auto;
            -webkit-app-region: no-drag;
            position: relative;
            z-index: 1;
        }

        .header-btns {
            display: flex;
            align-items: center;
            gap: 1rem;
        }

        .header-btn {
            -webkit-app-region: no-drag;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            background-color: #eeeeee10;

            .btn-icon {
                color: #999;
                opacity: 0.8;
                width: 24px;
                height: 24px;
            }

            &:hover {
                background-color: #eeeeee40;

                .btn-icon {
                    color: #fefefe;
                    opacity: 1;
                }
            }
        }
    }

    .info-container {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 101;
        width: 320px;
        height: 620px;
        display: flex;
        flex-direction: column;

        .cover {
            width: 100%;
            height: 320px;
            background-color: var(--primary-color-less);
            border-radius: 50%;
            overflow: hidden;
            padding: 10px;

            .img-container {
                width: 300px;
                height: 300px;
                border-radius: 50%;
                overflow: hidden;

                animation: rotate 20s linear infinite;
                animation-play-state: v-bind(active);

            }
        }

        .wy-cover {
            width: 300px;
            height: 300px;

            .video-cover {
                width: 300px;
                height: 300px;
                border-radius: 8px;
                overflow: hidden;
            }
        }

        .info-content {
            width: 100%;
            height: 300px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: var(--color-text-track);

            .icon {
                margin-right: 16px;
                opacity: 0.6;
            }

            .info-title {
                font-size: 20px;
                height: 30%;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .info-artist {
                font-size: 16px;
                height: 25%;

                display: flex;
                align-items: center;
                justify-content: center;
            }

            .info-album {
                font-size: 16px;
                height: 20%;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .progress-bar {
                width: 100%;
                height: 25%;
            }
        }

    }


    .player-lyric {
        z-index: 101;
        position: absolute;
        top: 50%;
        left: 45%;
        transform: translateY(-50%);
        width: 50vw;
        height: 80vh;
        overflow: hidden;
    }


    .control-panel {
        position: absolute;
        left: 0;
        width: 100%;
        height: 80px;
        z-index: 101;
        bottom: 0;
    }
}
</style>
