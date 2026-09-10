<template>
  <div v-if="snap && snap.phase === 'pending'" class="measure-confirm">
    <template v-if="snap.mode === 'distance'">
      <span class="mc-text">测距完成 · 总长 <b>{{ formatDistance(snap.totalDistance) }}</b></span>
    </template>
    <template v-else>
      <span class="mc-text">测面积完成 · 面积 <b>{{ formatArea(snap.area) }}</b> · 周长 <b>{{ formatDistance(snap.perimeter) }}</b></span>
    </template>
    <div class="mc-actions">
      <el-button size="small" @click="onResume">继续加点</el-button>
      <el-button size="small" type="primary" @click="onConfirm">完成</el-button>
    </div>
  </div>
</template>

<script setup>
import { storeToRefs } from 'pinia'
import { useMapStore } from '@/stores/map'
import { formatDistance, formatArea } from '@/utils/cesium'

const mapStore = useMapStore()
const { measureSnapshot: snap } = storeToRefs(mapStore)

function onResume() {
  mapStore.measureController?.resume()
}

function onConfirm() {
  mapStore.measureController?.confirmEnd()
}
</script>

<style scoped>
.measure-confirm {
  position: absolute;
  bottom: 96px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 11;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 18px;
  background: rgba(20, 30, 48, 0.92);
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}
.mc-text b { color: #00E5FF; }
.mc-actions { display: flex; gap: 8px; }
</style>
