<template>
  <div class="measure-tool">
    <el-radio-group v-model="measureMode" size="small">
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
    <el-button size="small" @click="undoMeasure" :disabled="!measureMode">
      <el-icon><RefreshLeft /></el-icon>
      撤销
    </el-button>
    <el-button size="small" type="warning" @click="openRoutePlan">
      <el-icon><Guide /></el-icon>
      航线规划
    </el-button>
    <el-button size="small" @click="flyToCampus">
      <el-icon><Location /></el-icon>
      定位校园
    </el-button>
    <div v-if="measureMode" class="measure-hint">
      左键加点 · 右键撤销 · 双击结束 · Esc 取消
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Position, Grid, Delete, Location, Guide, RefreshLeft } from '@element-plus/icons-vue'
import { useMapStore } from '@/stores/map'

const mapStore = useMapStore()

const measureMode = computed({
  get: () => mapStore.measureMode,
  set: (val) => mapStore.setMeasureMode(val)
})

function undoMeasure() {
  mapStore.measureController?.undo()
}

function clearMeasure() {
  // 清空全部测量实体并隐藏信息条，再退出测量态
  // 不能直接 viewer.entities.removeAll()，否则会误删无人机动画等业务实体
  mapStore.measureController?.clear()
  mapStore.measureSnapshot = null
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
  flex-wrap: wrap;
}

.measure-hint {
  width: 100%;
  margin-top: 4px;
  padding: 4px 8px;
  background: rgba(64, 158, 255, 0.15);
  border-radius: 4px;
  font-size: 12px;
  color: #79bbff;
  text-align: center;
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
