<template>
  <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24">
  <!-- 加号图标 -->
  <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
    <path stroke-dasharray="12" stroke-dashoffset="12" d="M10 14l-6.5 6.5M14 10l6.5 -6.5">
      <animate fill="freeze" attributeName="stroke-dashoffset" dur="0.3s" values="12;0"/>
    </path>
    <path stroke-dasharray="8" stroke-dashoffset="8" d="M21 3h-6M3 21v-6M21 3v6M3 21h6">
      <animate fill="freeze" attributeName="stroke-dashoffset" begin="0.3s" dur="0.2s" values="8;0"/>
    </path>
  </g>
  
  <!-- 减号图标 -->
  <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
    <path stroke-dasharray="12" stroke-dashoffset="12" d="M14 14l6.5 6.5M10 10l-6.5 -6.5">
      <animate fill="freeze" attributeName="stroke-dashoffset" dur="0.3s" values="12;0"/>
    </path>
    <path stroke-dasharray="8" stroke-dashoffset="8" d="M3 3h6M21 21v-6M3 3v6M21 21h-6">
      <animate fill="freeze" attributeName="stroke-dashoffset" begin="0.3s" dur="0.2s" values="8;0"/>
    </path>
  </g>
</svg>
</template>

<script setup lang="ts">


</script>

