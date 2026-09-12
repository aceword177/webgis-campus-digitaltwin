<template>
  <div v-if="popup" class="coverage-panel">
    <div class="cp-header">
      <span class="cp-title">{{ popup.canteenName }} · {{ popup.type === 'overview' ? '覆盖概览' : popup.seconds + 's 覆盖' }}</span>
      <el-icon class="cp-close" @click="close"><Close /></el-icon>
    </div>
    <template v-if="popup.type === 'overview'">
      <div v-for="t in tiers" :key="t.seconds" class="cp-tier" @click="showTier(t)">
        <span class="cp-tier-name">{{ t.seconds }}s · {{ fmtRadius(t.radius) }}</span>
        <span class="cp-tier-count">覆盖 {{ t.dormitories.length }} 栋</span>
      </div>
      <div v-if="!tiers.length" class="cp-empty">暂无覆盖数据</div>
    </template>
    <template v-else>
      <div class="cp-list">
        <div v-for="d in popup.dormitories" :key="d.id" class="cp-item">
          <span class="cp-item-name">{{ d.name }}</span>
          <span class="cp-item-meta">{{ fmtM(d.distance_m) }} · {{ d.seconds }}s</span>
        </div>
        <div v-if="!popup.dormitories.length" class="cp-empty">该档暂无覆盖宿舍</div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Close } from '@element-plus/icons-vue'
import { useMapStore } from '@/stores/map'

const mapStore = useMapStore()
const popup = computed(() => mapStore.coveragePopup)
const tiers = computed(() => {
  const c = (mapStore.canteenCoverage || []).find(x => x.canteen_id === popup.value?.canteenId)
  return c?.tiers || []
})

function showTier(t) {
  // 与查询面板（CanteenCoverageQuery）保持一致：档位点击同时高亮对应缓冲圈 + 宿舍
  mapStore.canteenActiveSelection = {
    type: 'tier',
    canteenId: popup.value.canteenId,
    seconds: t.seconds
  }
  mapStore.coveragePopup = {
    type: 'tier',
    canteenId: popup.value.canteenId,
    canteenName: popup.value.canteenName,
    seconds: t.seconds,
    dormitories: t.dormitories
  }
}
function close() {
  mapStore.coveragePopup = null
}
const fmtM = (v) => (v >= 1000 ? (v / 1000).toFixed(2) + ' km' : Math.round(v) + ' m')
const fmtRadius = (v) => (v || 0) + 'm'
</script>

<style scoped>
.coverage-panel {
  position: absolute;
  left: 16px;
  bottom: 80px;
  z-index: 12;
  width: 260px;
  max-height: 60vh;
  overflow-y: auto;
  background: rgba(20, 30, 48, 0.92);
  border-radius: 8px;
  padding: 10px 12px;
  color: #fff;
  font-size: 13px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
}
.cp-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.cp-title { font-weight: 600; }
.cp-close { cursor: pointer; color: rgba(255,255,255,0.7); }
.cp-close:hover { color: #fff; }
.cp-tier {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 8px; margin-bottom: 4px; border-radius: 4px;
  background: rgba(64, 158, 255, 0.12); cursor: pointer;
}
.cp-tier:hover { background: rgba(64, 158, 255, 0.25); }
.cp-tier-count { color: #79bbff; }
.cp-list { max-height: 40vh; overflow-y: auto; }
.cp-item { display: flex; justify-content: space-between; padding: 5px 2px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.cp-item-meta { color: rgba(255,255,255,0.6); }
.cp-empty { color: rgba(255,255,255,0.5); padding: 8px 0; text-align: center; }
</style>
