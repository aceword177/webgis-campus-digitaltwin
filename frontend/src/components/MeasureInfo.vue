<template>
  <div v-if="snap" class="measure-info">
    <template v-if="snap.mode === 'distance'">
      <span class="mi-label">测距</span>
      <span class="mi-item">点数 {{ snap.count }}</span>
      <span class="mi-item">末段 <b>{{ fmt(snap.lastSegment) }}</b></span>
      <span class="mi-item">累计 <b>{{ fmt(snap.totalDistance) }}</b></span>
    </template>
    <template v-else>
      <span class="mi-label">测面积</span>
      <span class="mi-item">点数 {{ snap.count }}</span>
      <span class="mi-item">面积 <b>{{ fmtArea(snap.area) }}</b></span>
      <span class="mi-item">周长 <b>{{ fmt(snap.perimeter) }}</b></span>
    </template>
    <span v-if="snap.phase === 'done'" class="mi-done">· 已定格</span>
  </div>
</template>

<script setup>
import { storeToRefs } from 'pinia'
import { useMapStore } from '@/stores/map'
import { formatDistance, formatArea } from '@/utils/cesium'

const { measureSnapshot: snap } = storeToRefs(useMapStore())
const fmt = (v) => formatDistance(v || 0)
const fmtArea = (v) => formatArea(v || 0)
</script>

<style scoped>
.measure-info {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 6px 14px;
  background: rgba(20, 30, 48, 0.9);
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}
.mi-label { color: #409EFF; font-weight: 600; }
.mi-item b { color: #00E5FF; }
.mi-done { color: rgba(255, 255, 255, 0.6); }
</style>
