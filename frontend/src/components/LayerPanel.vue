<template>
  <div class="layer-panel">
    <div class="panel-header">
      <span class="panel-title">图层控制</span>
    </div>
    <el-collapse v-model="activeNames" class="layer-collapse">
      <!-- 底图 -->
      <el-collapse-item title="底图" name="base">
        <div class="layer-item">
          <el-switch v-model="layers.baseImagery" @change="(v) => setLayerVisible('baseImagery', v)" />
          <span class="layer-name">影像底图</span>
        </div>
      </el-collapse-item>

      <!-- 建筑 -->
      <el-collapse-item title="建筑" name="building">
        <div class="layer-item">
          <el-switch v-model="layers.teaching" @change="(v) => setLayerVisible('teaching', v)" />
          <span class="layer-color" style="background: #4A90D9"></span>
          <span class="layer-name">教学楼</span>
        </div>
        <div class="layer-item">
          <el-switch v-model="layers.dormitory" @change="(v) => setLayerVisible('dormitory', v)" />
          <span class="layer-color" style="background: #E8943A"></span>
          <span class="layer-name">宿舍楼</span>
        </div>
        <div class="layer-item">
          <el-switch v-model="layers.other" @change="(v) => setLayerVisible('other', v)" />
          <span class="layer-color" style="background: #5CB85C"></span>
          <span class="layer-name">其他建筑</span>
        </div>
      </el-collapse-item>

      <!-- 道路 -->
      <el-collapse-item title="道路" name="road">
        <div class="layer-item">
          <el-switch v-model="layers.road" @change="(v) => setLayerVisible('road', v)" />
          <span class="layer-color" style="background: #888888"></span>
          <span class="layer-name">校园道路</span>
        </div>
      </el-collapse-item>

      <!-- 场地 -->
      <el-collapse-item title="运动场地" name="venue">
        <div class="layer-item">
          <el-switch v-model="layers.playground" @change="(v) => setLayerVisible('playground', v)" />
          <span class="layer-color" style="background: #C0392B"></span>
          <span class="layer-name">操场</span>
        </div>
        <div class="layer-item">
          <el-switch v-model="layers.basketball" @change="(v) => setLayerVisible('basketball', v)" />
          <span class="layer-color" style="background: #E67E22"></span>
          <span class="layer-name">篮球场</span>
        </div>
        <div class="layer-item">
          <el-switch v-model="layers.tennis" @change="(v) => setLayerVisible('tennis', v)" />
          <span class="layer-color" style="background: #27AE60"></span>
          <span class="layer-name">网球场</span>
        </div>
      </el-collapse-item>

      <!-- 校园边界 -->
      <el-collapse-item title="校园边界" name="school">
        <div class="layer-item">
          <el-switch v-model="layers.school" @change="(v) => setLayerVisible('school', v)" />
          <span class="layer-color" style="background: #FFFF00"></span>
          <span class="layer-name">校园范围</span>
        </div>
      </el-collapse-item>

      <!-- 无人机 -->
      <el-collapse-item title="无人机" name="drone">
        <div class="layer-item">
          <el-switch v-model="layers.drones" @change="(v) => setLayerVisible('drones', v)" />
          <span class="layer-color" style="background: #00FF00"></span>
          <span class="layer-name">无人机点位</span>
        </div>
      </el-collapse-item>

      <!-- 航线 -->
      <el-collapse-item title="飞行航线" name="route">
        <div class="layer-item">
          <el-switch v-model="layers.routes" @change="(v) => setLayerVisible('routes', v)" />
          <span class="layer-color" style="background: #FFD700"></span>
          <span class="layer-name">飞行航线</span>
        </div>
      </el-collapse-item>

      <!-- 限飞区 -->
      <el-collapse-item title="限飞区" name="nofly">
        <div class="layer-item">
          <el-switch v-model="layers.noFlyZones" @change="(v) => setLayerVisible('noFlyZones', v)" />
          <span class="layer-color" style="background: #FF4444"></span>
          <span class="layer-name">限飞区域</span>
        </div>
      </el-collapse-item>

      <!-- 配送标记 -->
      <el-collapse-item title="配送标记" name="delivery-markers">
        <div class="layer-item">
          <el-switch v-model="layers.restaurants" @change="(v) => setLayerVisible('restaurants', v)" />
          <span class="layer-color" style="background: #FF6B35"></span>
          <span class="layer-name">餐厅标记</span>
        </div>
        <div class="layer-item">
          <el-switch v-model="layers.dormitoryMarkers" @change="(v) => setLayerVisible('dormitoryMarkers', v)" />
          <span class="layer-color" style="background: #4A90D9"></span>
          <span class="layer-name">宿舍楼标记</span>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useMapStore } from '@/stores/map'

const mapStore = useMapStore()
const { layers } = storeToRefs(mapStore)
const { setLayerVisible } = mapStore

const activeNames = ref(['base', 'building', 'road', 'venue', 'school', 'drone', 'route', 'nofly', 'delivery-markers'])
</script>

<style scoped>
.layer-panel {
  width: 200px;
  background: rgba(20, 30, 48, 0.9);
  border-radius: 8px;
  overflow: hidden;
  color: #fff;
}

.panel-header {
  padding: 12px 16px;
  background: rgba(64, 158, 255, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
}

.layer-collapse {
  --el-collapse-border-color: transparent;
  --el-collapse-header-bg-color: transparent;
  --el-collapse-content-bg-color: transparent;
  --el-collapse-header-text-color: #fff;
  --el-collapse-content-text-color: #fff;
}

.layer-collapse :deep(.el-collapse-item__header) {
  padding: 8px 12px;
  font-size: 13px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.layer-collapse :deep(.el-collapse-item__content) {
  padding: 4px 12px 8px;
}

.layer-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.layer-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  flex-shrink: 0;
}

.layer-name {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
}
</style>
