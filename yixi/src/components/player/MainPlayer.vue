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
            <img :src="coverUrl" alt="" class="bg-cover" style="width: 100%;height: 100%;object-fit: cover;" @error="handleCoverError">
        </div>
        
        <div class="model-bg"></div>
        <!-- cover & song info -->
        <div class="info-container" ref="infoContainer">
            <div class="glass-cover-card">
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
                <div class="info-meta-row" :title="currentSong?.singer || '未知歌手'">
                    <div class="meta-icon-badge">
                        <n-icon :component="Mic2" :size="13" />
                    </div>
                    <span class="meta-text">{{ currentSong?.singer || '未知歌手' }}</span>
                </div>
                <div class="info-meta-row album-row" :title="currentSong?.album || '未知专辑'">
                    <div class="meta-icon-badge">
                        <n-icon :component="Disc3" :size="13" />
                    </div>
                    <span class="meta-text">{{ currentSong?.album || '未知专辑' }}</span>
                </div>
                <div class="progress-bar-wrapper">
                    <ProgressPanel />
                </div>
            </div>
        </div>
        <!-- 歌词 -->
        <AMLyric v-if="AMLyricView" ref="playerLyric" class="player-lyric" />
        <CommonLyric v-else-if="lyricStore.hasLyric" ref="playerLyric" class="player-lyric" />
        <!-- 控制面板 -->
        <Transition name="ctlp" mode="default">
            <ControlPanel class="control-panel" v-show="isMouseActive" />
        </Transition>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue';
import { NIcon } from 'naive-ui';
import { Mic2, Disc3 } from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { useAudioStore, useCommonStore, useLyricStore } from '@/store';
import { ControlPanel } from '.';
import { defaultSongCover } from '@/utils/common';
import { AMLyric, CommonLyric } from '.';
import { ArrowDownIcon, CloseIcon, MiniWindowIcon, RestoreIcon, ScaleIcon } from '@/icons';
import electronAPI from '@/utils/electron';
import ProgressPanel from './ProgressPanel.vue';
import { useSongCoverUrl } from '@/composables/useSongCoverUrl';
import PlayerBackground from './PlayerBackground.vue';
const playerStore = useAudioStore()
const { currentSong } = storeToRefs(playerStore)
const commonStore = useCommonStore()
const lyricStore = useLyricStore()

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

const playerLayout = ref<HTMLDivElement>()
const infoContainer = ref<HTMLDivElement>()
const setCoverBgPosition = async () => {
    if (!infoContainer.value) return
    if (currentSong.value?.id && lyricStore.hasLyric) {
        infoContainer.value.style.left = '25%'
    } else {
        infoContainer.value.style.left = '50%'
    }
}

watch([() => currentSong.value?.id, () => lyricStore.hasLyric], () => {
    void setCoverBgPosition()
})

const handleCoverError = (event: Event) => {
    const image = event.target as HTMLImageElement | null
    if (!image || image.dataset.fallbackCover === "true") return
    image.dataset.fallbackCover = "true"
    image.src = defaultSongCover
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
            width: 300px;
            height: 300px;
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
                0 24px 64px rgba(0, 0, 0, 0.38),
                0 8px 24px rgba(0, 0, 0, 0.22),
                inset 0 1.5px 2px rgba(255, 255, 255, 0.65),
                inset 0 -1.5px 2px rgba(0, 0, 0, 0.15);
            transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.35s ease;
            box-sizing: border-box;

            &:hover {
                transform: translateY(-4px) scale(1.02);
                box-shadow:
                    0 32px 76px rgba(0, 0, 0, 0.46),
                    0 12px 30px rgba(0, 0, 0, 0.28),
                    inset 0 1.5px 2px rgba(255, 255, 255, 0.75),
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
            margin-top: 22px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            text-align: center;
            color: var(--color-text-track);

            .info-title {
                width: 100%;
                font-size: 22px;
                font-weight: 800;
                line-height: 1.35;
                color: #ffffff;
                text-shadow: 0 2px 16px rgba(0, 0, 0, 0.45);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                padding: 0 10px;
                box-sizing: border-box;
                letter-spacing: 0.2px;
            }

            .info-meta-row {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 7px;
                max-width: 100%;
                padding: 0 10px;
                box-sizing: border-box;

                .meta-icon-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.14);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    color: rgba(255, 255, 255, 0.9);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    flex-shrink: 0;
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
                }

                .meta-text {
                    color: rgba(255, 255, 255, 0.85);
                    font-size: 14px;
                    font-weight: 500;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    text-shadow: 0 1px 8px rgba(0, 0, 0, 0.35);
                }

                &.album-row {
                    .meta-icon-badge {
                        background: rgba(255, 255, 255, 0.1);
                        border-color: rgba(255, 255, 255, 0.15);
                        color: rgba(255, 255, 255, 0.7);
                    }

                    .meta-text {
                        color: rgba(255, 255, 255, 0.65);
                        font-size: 13px;
                    }
                }
            }

            .progress-bar-wrapper {
                width: 100%;
                margin-top: 8px;
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
