<template>
    <div class="playing">
        <div class="playing-item"></div>
        <div class="playing-item"></div>
        <div class="playing-item"></div>
    </div>
</template>

<script setup lang="ts">

</script>

<style scoped lang="scss">
.playing {
    display: flex;
    align-items: flex-end;
    height: 40px;
    gap: 2px;

    .playing-item {
        position: relative;
        width: 8px;
        height: 100%;
        background-color: var(--color-primary);
        border-radius: 4px;
        transform-origin: bottom;
        animation: wave-up 1.2s infinite cubic-bezier(0.4, 0, 0.2, 1);
        
        &:nth-child(1) { animation-delay: 0s; }
        &:nth-child(2) { animation-delay: 0.2s; }
        &:nth-child(3) { animation-delay: 0.4s; }
    }

    .item-1 {
        left: 0;
    }
    .item-2 {
        left: 33%;
    }   

    .item-3 {
        left: 66%;
    }
}

@keyframes wave-up {
    0%, 100% {
        transform: scaleY(0.1) translateY(0);
    }
    25% {
        transform: scaleY(0.9) ;
    }
    50% {
        transform: scaleY(0.4) ;
    }
    75% {
        transform: scaleY(0.7) ;
    }
}

</style>
