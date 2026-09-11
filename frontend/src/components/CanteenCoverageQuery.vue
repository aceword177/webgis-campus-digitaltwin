<template>
  <div v-if="mapStore.layers.canteenBuffer && mapStore.canteenCoverage" class="cq-panel">
    <!-- 标题栏 -->
    <div class="cq-header" @click="collapsed = !collapsed">
      <span class="cq-title">食堂缓冲区覆盖范围查询</span>
      <el-icon class="cq-arrow">
        <ArrowUp v-if="!collapsed" />
        <ArrowDown v-else />
      </el-icon>
    </div>

    <!-- 展开内容 -->
    <div v-show="!collapsed" class="cq-body">
      <!-- 两个食堂的 3 档覆盖统计 -->
      <div
        v-for="c in mapStore.canteenCoverage"
        :key="c.canteen_id"
        class="cq-canteen"
      >
        <div class="cq-canteen-name">{{ c.name }}</div>
        <div class="cq-tiers">
          <span
            v-for="t in c.tiers"
            :key="t.seconds"
            class="cq-tier"
            :style="{ color: tierColor(t.seconds) }"
            @click="showTier(c, t)"
          >
            {{ t.seconds }}s:{{ t.dormitories.length }}栋
          </span>
        </div>
      </div>

      <!-- 图例 -->
      <div class="cq-legend">
        <div class="cq-legend-item">
          <span class="cq-dot" style="background:#2ECC40"></span>30s · 150m
        </div>
        <div class="cq-legend-item">
          <span class="cq-dot" style="background:#FF851B"></span>60s · 300m
        </div>
        <div class="cq-legend-item">
          <span class="cq-dot" style="background:#FF4136"></span>90s · 450m
        </div>
        <div class="cq-note">圆=时间参考线 · 高亮点=实际覆盖宿舍</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ArrowUp, ArrowDown } from '@element-plus/icons-vue'
import { useMapStore } from '@/stores/map'

const mapStore = useMapStore()
const collapsed = ref(false) // 默认展开

const TIER_COLORS = { 30: '#2ECC40', 60: '#FF851B', 90: '#FF4136' }
function tierColor(seconds) {
  return TIER_COLORS[seconds] || '#fff'
}

// 点击档位：写入 coveragePopup，复用 CesiumViewer 的 watch 高亮联动 + 浮窗
function showTier(canteen, tier) {
  mapStore.coveragePopup = {
    type: 'tier',
    canteenId: canteen.canteen_id,
    canteenName: canteen.name,
    seconds: tier.seconds,
    dormitories: tier.dormitories
  }
}
</script>

<style scoped>
.cq-panel {
  position: absolute;
  left: 16px;
  bottom: 120px;
  z-index: 11;
  width: 250px;
  background: rgba(20, 30, 48, 0.92);
  border-radius: 8px;
  color: #fff;
  font-size: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
  overflow: hidden;
}
.cq-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.cq-header:hover {
  background: rgba(64, 158, 255, 0.1);
}
.cq-title {
  font-weight: 600;
  font-size: 13px;
}
.cq-arrow {
  color: rgba(255, 255, 255, 0.7);
}
.cq-body {
  padding: 8px 12px 10px;
}
.cq-canteen {
  margin-bottom: 8px;
}
.cq-canteen-name {
  font-weight: 600;
  margin-bottom: 3px;
  color: rgba(255, 255, 255, 0.9);
}
.cq-tiers {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.cq-tier {
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
  transition: background 0.15s;
}
.cq-tier:hover {
  background: rgba(255, 255, 255, 0.12);
}
.cq-legend {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.cq-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.8);
}
.cq-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.cq-note {
  color: rgba(255, 255, 255, 0.5);
  margin-top: 4px;
  font-size: 11px;
}
</style>
