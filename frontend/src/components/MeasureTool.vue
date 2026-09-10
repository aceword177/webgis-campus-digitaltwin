<template>
  <div class="measure-tool">
    <el-radio-group v-model="measureMode" size="small" @change="handleModeChange">
      <el-radio-button value="distance">
        <el-icon><Position /></el-icon>
        测距
      </el-radio-button>
      <el-radio-button value="area">
        <el-icon><Grid /></el-icon>
        测面积
      </el-radio-button>
    </el-radio-group>
    <el-button size="small" @click="clearMeasure">
      <el-icon><Delete /></el-icon>
      清除
    </el-button>
    <el-button size="small" type="warning" @click="openRoutePlan">
      <el-icon><Guide /></el-icon>
      航线规划
    </el-button>
    <el-button size="small" @click="flyToCampus">
      <el-icon><Location /></el-icon>
      定位校园
    </el-button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Position, Grid, Delete, Location, Guide } from '@element-plus/icons-vue'
import { useMapStore } from '@/stores/map'

const mapStore = useMapStore()

const measureMode = computed({
  get: () => mapStore.measureMode,
  set: (val) => mapStore.setMeasureMode(val)
})

function handleModeChange(val) {
  if (val === 'distance') {
    // 提示操作方式
  }
}

function clearMeasure() {
  // 置空测量模式会触发 CesiumViewer 的 watch -> stopMeasure()，只清理测量实体
  // 不能直接 viewer.entities.removeAll()，否则会误删无人机动画等业务实体
  mapStore.setMeasureMode(null)
}

function openRoutePlan() {
  mapStore.togglePanel('route')
}

function flyToCampus() {
  mapStore.flyToCampus()
}
</script>

<style scoped>
.measure-tool {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(20, 30, 48, 0.9);
  border-radius: 8px;
}

.measure-tool :deep(.el-radio-button__inner) {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.8);
}

.measure-tool :deep(.el-radio-button.is-active .el-radio-button__inner) {
  background: rgba(64, 158, 255, 0.6);
  border-color: #409EFF;
  color: #fff;
}
</style>
