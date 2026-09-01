<template>
    <div class="player-layout">
        <PlayerBackground :fps="60" :album="coverUrl"></PlayerBackground>
        <Transition name="header" mode="default">
            <div class="header-bar" v-show="isMouseActive">
                <div class="header-drag-region"></div>
                <div class="header-side">
                    <div
                        class="header-btn"
                        :class="{ active: showLyric }"
                        :title="showLyric ? '隐藏歌词' : '显示歌词'"
                        @click="toggleLyricVisibility"
                    >
                        <LyricIcon class="btn-icon" />
                    </div>
                </div>
                <div class="header-btns">
                    <div class="header-btn" @click="electronAPI.minimizeWindow" title="最小化">
                        <MiniWindowIcon class="btn-icon" />
                    </div>
                    <div class="header-btn" @click="commonStore.handleToggleFullscreen" :title="commonStore.isFullscreen ? '退出全屏' : '全屏'">
                        <RestoreIcon v-if="commonStore.isFullscreen" class="btn-icon" />
                        <ScaleIcon v-else class="btn-icon" />
                    </div>
                    <div class="header-btn" @click="commonStore.hidePlayer" title="收起播放器">
                        <CloseIcon class="btn-icon" />
                    </div>
                </div>
            </div>
        </Transition>
        <div>
            <img :src="coverUrl" alt="" class="bg-cover" style="width: 100%;height: 100%;object-fit: cover;" @error="handleCoverError">
        </div>
        
        <div class="model-bg"></div>
        <!-- cover & song info -->
        <div class="info-container" ref="infoContainer">
            <div class="glass-cover-card" :class="{ 'is-playing': isPlaying }">
                <div class="glass-cover-glow"></div>
                <div class="glass-cover-frame">
                    <video
                        v-if="currentSong?.d_cover"
                        autoplay
                        loop
                        muted
                        playsinline
                        class="cover-media"
                        :src="currentSong.d_cover"
                    />
                    <img
                        v-else
                        :src="coverUrl"
                        alt=""
                        class="cover-media"
                        @error="handleCoverError"
                    />
                </div>
            </div>
            <div class="info-content">
                <div class="info-title" :title="songName || '未播放'">
                    <span>{{ songName || '未播放' }}</span>
                </div>
                <div class="info-artist" :title="currentSong?.singer || '未知歌手'">
                    <span>{{ currentSong?.singer || '未知歌手' }}</span>
                </div>
                <div
                    v-if="currentSong?.album && currentSong.album !== currentSong.name"
                    class="info-album-pill"
                    :title="currentSong.album"
                >
                    <n-icon :component="Disc3" :size="12" class="album-icon" />
                    <span class="album-text">{{ currentSong.album }}</span>
                </div>
            </div>
        </div>
        <!-- 歌词 -->
        <AMLyric v-if="showLyric && AMLyricView" ref="playerLyric" class="player-lyric" />
        <CommonLyric v-else-if="showLyric && lyricStore.hasLyric" ref="playerLyric" class="player-lyric" />
        <!-- 频谱仪 -->
        <SpectrumVisualizer
            class="player-spectrum"
            :cover-url="coverUrl"
            :class="{ 'docked-panel': isMouseActive, 'docked-bottom': !isMouseActive }"
        />
        <!-- 控制面板 -->
        <Transition name="ctlp" mode="default">
            <ControlPanel class="control-panel" v-show="isMouseActive" />
        </Transition>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue';
import { NIcon } from 'naive-ui';
import { Disc3 } from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { useAudioStore, useCommonStore, useLyricStore } from '@/store';
import { ControlPanel, SpectrumVisualizer } from '.';
import { defaultSongCover } from '@/utils/common';
import { AMLyric, CommonLyric } from '.';
import { LyricIcon, CloseIcon, MiniWindowIcon, RestoreIcon, ScaleIcon } from '@/icons';
import electronAPI from '@/utils/electron';
import { useSongCoverUrl } from '@/composables/useSongCoverUrl';
import PlayerBackground from './PlayerBackground.vue';
import type { PlayerControlsVisibilityEvent } from '@/types/playerControls';
const playerStore = useAudioStore()
const { currentSong, isPlaying } = storeToRefs(playerStore)
const commonStore = useCommonStore()
const lyricStore = useLyricStore()

const showLyric = ref(true);

const toggleLyricVisibility = () => {
    showLyric.value = !showLyric.value;
    void setCoverBgPosition();
};

const AMLyricView = computed(() => {
    return Boolean(currentSong.value?.id && lyricStore.hasLyric && lyricStore.setting.useAMLyric)
})

const coverUrl = useSongCoverUrl(currentSong, 240)

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

const infoContainer = ref<HTMLDivElement>()
const setCoverBgPosition = async () => {
    if (!infoContainer.value) return
    if (showLyric.value && currentSong.value?.id && lyricStore.hasLyric) {
        infoContainer.value.style.left = '25%'
    } else {
        infoContainer.value.style.left = '50%'
    }
}

watch([() => currentSong.value?.id, () => lyricStore.hasLyric, () => showLyric.value], () => {
    void setCoverBgPosition()
})

const handleCoverError = (event: Event) => {
    const image = event.target as HTMLImageElement | null
    if (!image || image.dataset.fallbackCover === "true") return
    image.dataset.fallbackCover = "true"
    image.src = defaultSongCover
}

const isMouseActive = ref(true);

const updateMouseActive = (active: boolean) => {
    if (isMouseActive.value === active) return;
    isMouseActive.value = active;
};

let stopPlayerControlsVisibility: (() => void) | null = null;

const handlePlayerControlsVisibility = (event: PlayerControlsVisibilityEvent) => {
    updateMouseActive(event.visible);
};

const notifyRendererInteraction = () => {
    electronAPI.notifyPlayerControlsInteraction();
};

const initInteractionListeners = () => {
    document.addEventListener('mousedown', notifyRendererInteraction, { passive: true });
    document.addEventListener('keydown', notifyRendererInteraction);
};

const removeInteractionListeners = () => {
    document.removeEventListener('mousedown', notifyRendererInteraction);
    document.removeEventListener('keydown', notifyRendererInteraction);
};

watch(() => isMouseActive.value, (active) => {
    document.body.style.cursor = active ? 'default' : 'none';
}, { immediate: false });

onMounted(() => {
    setCoverBgPosition();
    stopPlayerControlsVisibility = electronAPI.onPlayerControlsVisibility(
        handlePlayerControlsVisibility
    );
    electronAPI.startPlayerControlsTracking();
    initInteractionListeners();
});

onBeforeUnmount(() => {
    removeInteractionListeners();
    stopPlayerControlsVisibility?.();
    stopPlayerControlsVisibility = null;
    electronAPI.stopPlayerControlsTracking();
    document.body.style.cursor = 'default';
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
        display: flex;
        flex-direction: column;
        align-items: center;
        transition: left 0.5s cubic-bezier(0.25, 1, 0.5, 1);
        user-select: none;

        .glass-cover-card {
            position: relative;
            width: 290px;
            height: 290px;
            margin: 0 auto;
            border-radius: 28px;
            padding: 10px;
            background: linear-gradient(
                135deg,
                rgba(255, 255, 255, 0.24) 0%,
                rgba(255, 255, 255, 0.07) 50%,
                rgba(255, 255, 255, 0.14) 100%
            );
            border: 1px solid rgba(255, 255, 255, 0.35);
            backdrop-filter: blur(28px) saturate(160%);
            -webkit-backdrop-filter: blur(28px) saturate(160%);
            box-shadow:
                0 20px 52px rgba(0, 0, 0, 0.35),
                0 6px 18px rgba(0, 0, 0, 0.2),
                inset 0 1.5px 2px rgba(255, 255, 255, 0.65),
                inset 0 -1.5px 2px rgba(0, 0, 0, 0.15);
            transform: scale(1);
            transition: transform 0.45s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.45s ease;
            box-sizing: border-box;

            &.is-playing {
                transform: translateY(-2px) scale(1.05);
                box-shadow:
                    0 28px 70px rgba(0, 0, 0, 0.44),
                    0 10px 26px rgba(0, 0, 0, 0.25),
                    inset 0 1.5px 2px rgba(255, 255, 255, 0.72),
                    inset 0 -1.5px 2px rgba(0, 0, 0, 0.15);

                .glass-cover-glow {
                    opacity: 0.65;
                    filter: blur(24px);
                }
            }

            &:hover {
                transform: translateY(-4px) scale(1.08);
                box-shadow:
                    0 34px 80px rgba(0, 0, 0, 0.48),
                    0 12px 30px rgba(0, 0, 0, 0.28),
                    inset 0 1.5px 2px rgba(255, 255, 255, 0.78),
                    inset 0 -1.5px 2px rgba(0, 0, 0, 0.15);
            }

            .glass-cover-glow {
                position: absolute;
                inset: 14px;
                border-radius: 22px;
                background: inherit;
                filter: blur(20px);
                opacity: 0.45;
                z-index: 0;
                pointer-events: none;
                transition: opacity 0.45s ease, filter 0.45s ease;
            }

            .glass-cover-frame {
                position: relative;
                z-index: 1;
                width: 100%;
                height: 100%;
                border-radius: 20px;
                overflow: hidden;
                background: rgba(0, 0, 0, 0.2);
                box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.15);

                .cover-media {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                    border-radius: 20px;
                }
            }
        }

        .info-content {
            width: 100%;
            margin-top: 18px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            text-align: center;
            color: var(--color-text-track);

            .info-title {
                width: 100%;
                font-size: 21px;
                font-weight: 700;
                line-height: 1.3;
                color: #ffffff;
                text-shadow: 0 2px 14px rgba(0, 0, 0, 0.45);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                padding: 0 8px;
                box-sizing: border-box;
                letter-spacing: 0.2px;
            }

            .info-artist {
                width: 100%;
                font-size: 14px;
                font-weight: 500;
                line-height: 1.35;
                color: rgba(255, 255, 255, 0.82);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                padding: 0 8px;
                box-sizing: border-box;
                text-shadow: 0 1px 8px rgba(0, 0, 0, 0.35);
            }

            .info-album-pill {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                max-width: 90%;
                margin-top: 2px;
                padding: 3px 12px;
                border-radius: 12px;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.14);
                color: rgba(255, 255, 255, 0.72);
                font-size: 12px;
                font-weight: 400;
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                box-sizing: border-box;

                .album-icon {
                    flex-shrink: 0;
                    color: rgba(255, 255, 255, 0.7);
                }

                .album-text {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
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


    .player-spectrum {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        width: min(1200px, 92vw);
        height: 46px;
        z-index: 100;
        pointer-events: none;
        transition: bottom 0.6s ease-in-out, opacity 0.3s ease;

        &.docked-panel {
            bottom: 86px;
        }

        &.docked-bottom {
            bottom: 14px;
        }
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
