# 食堂缓冲区辐射范围 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 后端按导航路径时间（30s/60s/90s）计算每个食堂对宿舍的累积覆盖并暴露接口；前端渲染 3 层圆形参考缓冲圈 + 点击查看概览/清单 + 宿舍高亮 + 图例。

**Architecture:** 后端 `RestaurantServiceImpl.getCoverage()` 复用现有导航查询（findNearestWalkableNode / findShortestPath / buildRouteFromNodes）计算食堂→宿舍导航时间，按 ≤30/≤60/≤90s 分档累积，经 `GET /api/restaurant/coverage` 返回；前端 `loadCanteenBuffer` 渲染 ellipse 同心圈（绿/橙/红），点击食堂标记显示概览、点击缓冲圈显示该档清单并临时高亮宿舍，图层开关走现有 `layers/dataSources` 机制。

**Tech Stack:** Spring Boot + MyBatis + pgRouting（后端）；Vue3 + Cesium + Pinia（前端）

## Global Constraints

- 时间档：30s/60s/90s；圆形参考半径 = `seconds × 5.0`（150/300/450m）；覆盖时间 = `ceil(distance_m / 5.0)`（与 `RouteServiceImpl.FLIGHT_SPEED`、`estimatedSeconds` 同口径）。
- 覆盖语义：每档 = **累积**（导航路径时间 ≤ 该档秒数的全部宿舍，按 seconds 升序）；A* 不可达的宿舍不计入任何档。
- 缓冲圈为**圆形参考线**（直线半径），实际覆盖宿舍用**高亮标记点**表达（圈≠实际覆盖）。
- `DormitoryCoverageVO` 必须包含 `lng/lat`（宿舍中心，供前端高亮）。
- 不新增第三方依赖；不改动无人机/航线/测量/限飞区现有逻辑；不新增导航表结构。
- 图层默认开启：`layers.canteenBuffer = true`。
- 前端构建：`cd "D:\iDEA-Data\webgis-campus-digitaltwin-mvp\frontend"; npm run build`；后端编译：`$env:JAVA_HOME="D:\IntelliJ IDEA 2026.2.0.1\jbr"; $env:Path="$env:JAVA_HOME\bin;$env:Path"; & "D:\IntelliJ IDEA 2026.2.0.1\plugins\maven-plugin\lib\maven3\bin\mvn.cmd" -q compile`（PowerShell 5.1，无 &&，用 `;`）。
- 每个任务以对应构建/验证通过 + git 提交收尾。

---

### Task 1: 后端 DTO + 宿舍中心查询

**Files:**
- Create: `backend/src/main/java/com/campus/twin/dto/DormitoryCoverageVO.java`
- Create: `backend/src/main/java/com/campus/twin/dto/TierCoverageVO.java`
- Create: `backend/src/main/java/com/campus/twin/dto/CanteenCoverageVO.java`
- Modify: `backend/src/main/java/com/campus/twin/mapper/SpatialQueryMapper.java`（末尾追加方法）

**Interfaces:**
- Produces: `CanteenCoverageVO{Integer canteenId, String name, Double centerLng, Double centerLat, List<TierCoverageVO> tiers}`；`TierCoverageVO{Integer seconds, Double radius, List<DormitoryCoverageVO> dormitories}`；`DormitoryCoverageVO{Integer id, String name, Double distanceM, Integer seconds, Double lng, Double lat}`；`SpatialQueryMapper.findDormitoryCentroids() : List<Map<String,Object>>`（键 id/name/lng/lat）

- [ ] **Step 1: 创建三个 VO**

```java
// DormitoryCoverageVO.java
package com.campus.twin.dto;
import lombok.Builder;
import lombok.Data;
import java.io.Serializable;
@Data
@Builder
public class DormitoryCoverageVO implements Serializable {
    private Integer id;
    private String name;
    private Double distanceM;
    private Integer seconds;
    private Double lng;
    private Double lat;
}
```
```java
// TierCoverageVO.java
package com.campus.twin.dto;
import lombok.Builder;
import lombok.Data;
import java.io.Serializable;
import java.util.List;
@Data
@Builder
public class TierCoverageVO implements Serializable {
    private Integer seconds;
    private Double radius;
    private List<DormitoryCoverageVO> dormitories;
}
```
```java
// CanteenCoverageVO.java
package com.campus.twin.dto;
import lombok.Builder;
import lombok.Data;
import java.io.Serializable;
import java.util.List;
@Data
@Builder
public class CanteenCoverageVO implements Serializable {
    private Integer canteenId;
    private String name;
    private Double centerLng;
    private Double centerLat;
    private List<TierCoverageVO> tiers;
}
```

- [ ] **Step 2: SpatialQueryMapper 追加方法**

在接口末尾（`selectRoadStats` 之后）追加：
```java
    /**
     * 查询所有宿舍楼质心坐标（供食堂覆盖计算）
     *
     * @return 宿舍列表（id, name, lng, lat）
     */
    @org.apache.ibatis.annotations.Select("SELECT id, name, ST_X(ST_Centroid(geom)) AS lng, ST_Y(ST_Centroid(geom)) AS lat FROM dormitory ORDER BY id")
    List<Map<String, Object>> findDormitoryCentroids();
```

- [ ] **Step 3: 编译验证**

```powershell
cd "D:\iDEA-Data\webgis-campus-digitaltwin-mvp\backend"
$env:JAVA_HOME="D:\IntelliJ IDEA 2026.2.0.1\jbr"; $env:Path="$env:JAVA_HOME\bin;$env:Path"
& "D:\IntelliJ IDEA 2026.2.0.1\plugins\maven-plugin\lib\maven3\bin\mvn.cmd" -q compile
```
Expected: BUILD SUCCESS（无输出即成功）。

- [ ] **Step 4: 提交**：`git add backend/src/main/java/com/campus/twin/dto/DormitoryCoverageVO.java backend/src/main/java/com/campus/twin/dto/TierCoverageVO.java backend/src/main/java/com/campus/twin/dto/CanteenCoverageVO.java backend/src/main/java/com/campus/twin/mapper/SpatialQueryMapper.java; git commit -m "feat(backend): coverage DTOs + dormitory centroid query"`

### Task 2: 后端覆盖计算 Service + Controller

**Files:**
- Modify: `backend/src/main/java/com/campus/twin/service/RestaurantService.java`（接口加 `getCoverage()`）
- Modify: `backend/src/main/java/com/campus/twin/service/impl/RestaurantServiceImpl.java`（实现 + 注入 NavigationMapper + FLIGHT_SPEED）
- Modify: `backend/src/main/java/com/campus/twin/controller/RestaurantController.java`（加 `/coverage` 端点）

**Interfaces:**
- Consumes: `SpatialQueryMapper.findDormitoryCentroids()`（Task 1）、`NavigationMapper.findNearestWalkableNode(lng,lat)`、`findShortestPath(startNodeId,endNodeId)`、`buildRouteFromNodes(nodeIds)`、`RestaurantService.getDetail(id)`（已有）
- Produces: `RestaurantService.getCoverage() : List<CanteenCoverageVO>`；`GET /api/restaurant/coverage`

- [ ] **Step 1: 接口方法**

`RestaurantService.java` 追加：
```java
    /** 食堂缓冲区覆盖：按导航路径时间（30s/60s/90s）分档 */
    List<CanteenCoverageVO> getCoverage();
```
import `com.campus.twin.dto.CanteenCoverageVO`、`java.util.List`（如缺失）。

- [ ] **Step 2: 实现 getCoverage()**

`RestaurantServiceImpl.java`：
- 类字段追加：`private final NavigationMapper navigationMapper;`（@RequiredArgsConstructor 自动注入）；`private static final double FLIGHT_SPEED = 5.0;`
- import 追加：`com.campus.twin.dto.CanteenCoverageVO/TierCoverageVO/DormitoryCoverageVO`、`com.campus.twin.mapper.NavigationMapper`、`java.util.ArrayList/Comparator/stream.Collectors`
- 实现：
```java
    @Override
    public List<CanteenCoverageVO> getCoverage() {
        List<Restaurant> restaurants = restaurantMapper.selectList(null);
        List<Map<String, Object>> dorms = spatialQueryMapper.findDormitoryCentroids();
        List<CanteenCoverageVO> result = new ArrayList<>();
        if (restaurants == null || dorms == null || dorms.isEmpty()) {
            return result;
        }
        for (Restaurant r : restaurants) {
            RestaurantDetailVO detail = getDetail(r.getId());
            if (detail == null || detail.getCenterLng() == null || detail.getCenterLat() == null) {
                continue;
            }
            Integer startNode = nearestWalkableNode(detail.getCenterLng(), detail.getCenterLat());
            if (startNode == null) {
                continue;
            }
            List<DormitoryCoverageVO> all = new ArrayList<>();
            for (Map<String, Object> dorm : dorms) {
                Number dormId = (Number) dorm.get("id");
                String dormName = (String) dorm.get("name");
                double lng = ((Number) dorm.get("lng")).doubleValue();
                double lat = ((Number) dorm.get("lat")).doubleValue();
                Integer endNode = nearestWalkableNode(lng, lat);
                if (endNode == null) {
                    continue;
                }
                List<Map<String, Object>> path = navigationMapper.findShortestPath(startNode, endNode);
                if (path == null || path.isEmpty()) {
                    continue; // A* 不可达，不计入任何档
                }
                List<Integer> nodeIds = path.stream()
                        .sorted((a, b) -> Integer.compare(
                                ((Number) a.get("path_seq")).intValue(),
                                ((Number) b.get("path_seq")).intValue()))
                        .map(m -> ((Number) m.get("node")).intValue())
                        .collect(Collectors.toList());
                String nodeIdsStr = "{" + nodeIds.stream().map(String::valueOf).collect(Collectors.joining(",")) + "}";
                Map<String, Object> routeData = navigationMapper.buildRouteFromNodes(nodeIdsStr);
                double distanceM = routeData.get("distance_m") != null
                        ? ((Number) routeData.get("distance_m")).doubleValue() : 0.0;
                int seconds = (int) Math.ceil(distanceM / FLIGHT_SPEED);
                all.add(DormitoryCoverageVO.builder()
                        .id(dormId.intValue())
                        .name(dormName)
                        .distanceM(distanceM)
                        .seconds(seconds)
                        .lng(lng)
                        .lat(lat)
                        .build());
            }
            all.sort(Comparator.comparingInt(DormitoryCoverageVO::getSeconds));
            List<TierCoverageVO> tiers = new ArrayList<>();
            for (int sec : new int[]{30, 60, 90}) {
                final int threshold = sec;
                tiers.add(TierCoverageVO.builder()
                        .seconds(sec)
                        .radius(sec * FLIGHT_SPEED)
                        .dormitories(all.stream()
                                .filter(d -> d.getSeconds() <= threshold)
                                .collect(Collectors.toList()))
                        .build());
            }
            result.add(CanteenCoverageVO.builder()
                    .canteenId(r.getId())
                    .name(r.getName())
                    .centerLng(detail.getCenterLng())
                    .centerLat(detail.getCenterLat())
                    .tiers(tiers)
                    .build());
        }
        return result;
    }

    private Integer nearestWalkableNode(Double lng, Double lat) {
        Map<String, Object> node = navigationMapper.findNearestWalkableNode(lng, lat);
        return node == null ? null : ((Number) node.get("id")).intValue();
    }
```

- [ ] **Step 3: Controller 端点**

`RestaurantController.java` 追加（import `com.campus.twin.dto.CanteenCoverageVO`、`java.util.List`）：
```java
    @Operation(summary = "食堂缓冲区覆盖（按导航路径时间 30/60/90s 分档）")
    @GetMapping("/coverage")
    public Result<List<CanteenCoverageVO>> coverage() {
        return Result.success(restaurantService.getCoverage());
    }
```
注意：`/coverage` 为字面量，与 `/{id}` 不冲突（Spring 字面量优先）。

- [ ] **Step 4: 编译验证**（命令同 Task 1 Step 3），Expected: BUILD SUCCESS
- [ ] **Step 5: 提交**：`git add backend/src/main/java/com/campus/twin/service/RestaurantService.java backend/src/main/java/com/campus/twin/service/impl/RestaurantServiceImpl.java backend/src/main/java/com/campus/twin/controller/RestaurantController.java; git commit -m "feat(backend): canteen coverage by nav-path time tiers"`

### Task 3: 后端运行验证接口

**Files:** 无代码改动（验证 + 必要时修正提交）

- [ ] **Step 1: 启动后端（后台）**

```powershell
cd "D:\iDEA-Data\webgis-campus-digitaltwin-mvp\backend"
$env:JAVA_HOME="D:\IntelliJ IDEA 2026.2.0.1\jbr"; $env:Path="$env:JAVA_HOME\bin;$env:Path"
Start-Process -FilePath "D:\IntelliJ IDEA 2026.2.0.1\plugins\maven-plugin\lib\maven3\bin\mvn.cmd" -ArgumentList "spring-boot:run" -WindowStyle Hidden
```
等待约 30~60s 后轮询：`Invoke-RestMethod -Uri "http://localhost:8080/api/restaurant/coverage"`（若端口已占用说明后端已在跑，直接用）。

- [ ] **Step 2: 校验响应结构**

- 返回 `data` 数组长度 = 2（两个食堂）；
- 每项含 `canteenId/name/centerLng/centerLat/tiers`；`tiers` 长度 3（seconds=30/60/90，radius=150/300/450）；
- 每档 `dormitories` 按 seconds 升序且为累积（30s 档 ⊆ 60s 档 ⊆ 90s 档）；
- 抽查：任选一栋宿舍，用 psql 复算其导航时间与返回一致（可选，若时间充裕）。

- [ ] **Step 3: 停止后端进程**（验证完成后结束后台进程；若原本就在运行则保留）
- [ ] **Step 4: 提交修正**（若验证发现问题则修复后提交；无问题则跳过提交）

### Task 4: 前端 API + store 状态

**Files:**
- Modify: `frontend/src/api/restaurant.js`
- Modify: `frontend/src/stores/map.js`

**Interfaces:**
- Produces: `getRestaurantCoverage() : Promise<data>`（后端 `CanteenCoverageVO[]`）；store：`layers.canteenBuffer`（默认 true）、`canteenCoverage`（ref，null）、`coveragePopup`（ref，null，结构 `{type:'overview'|'tier', canteenId, canteenName, seconds?, dormitories?}`）

- [ ] **Step 1: API**

`frontend/src/api/restaurant.js` 追加：
```js
/** 食堂缓冲区覆盖（导航路径时间分档） */
export const getRestaurantCoverage = () => request.get('/api/restaurant/coverage')
```

- [ ] **Step 2: store**

`frontend/src/stores/map.js`：
- `layers` 中 `restaurants` 行后追加：`canteenBuffer: true,      // 食堂缓冲区（覆盖圈）`
- `measureController` ref 附近追加：
```js
  const canteenCoverage = ref(null)   // 食堂覆盖接口数据
  const coveragePopup = ref(null)     // 覆盖浮窗状态 {type, canteenId, canteenName, seconds?, dormitories?}
```
- return 列表追加：`canteenCoverage, coveragePopup,`

- [ ] **Step 3: 构建验证**：`cd "D:\iDEA-Data\webgis-campus-digitaltwin-mvp\frontend"; npm run build`
- [ ] **Step 4: 提交**：`git add frontend/src/api/restaurant.js frontend/src/stores/map.js; git commit -m "feat(frontend): coverage api + store state"`

### Task 5: cesium.js 缓冲圈渲染与宿舍高亮

**Files:**
- Modify: `frontend/src/utils/cesium.js`（文件末尾追加两个导出函数）

**Interfaces:**
- Produces: `loadCanteenBuffer(viewer, coverage, name) : CustomDataSource`（ellipse entity，`properties: {isCanteenTier:true, canteenId, seconds}`，id `canteen-tier-{canteenId}-{seconds}`）；`createDormitoryHighlight(viewer, dormList) : CustomDataSource`（红点 + 名称标签，position 用 d.lng/d.lat）
- Consumes: 后端 `coverage` 结构（Task 3）

- [ ] **Step 1: 追加 loadCanteenBuffer**

```js
/**
 * 加载食堂缓冲区（3 层同心圆形参考圈：30s/60s/90s）
 * 圈=时间参考线（直线半径），实际覆盖宿舍由点击时高亮表达
 */
export function loadCanteenBuffer(viewer, coverage, name) {
  const dataSource = new Cesium.CustomDataSource(name)
  const TIER_STYLE = [
    { seconds: 30, color: Cesium.Color.fromCssColorString('#2ECC40') },
    { seconds: 60, color: Cesium.Color.fromCssColorString('#FF851B') },
    { seconds: 90, color: Cesium.Color.fromCssColorString('#FF4136') }
  ]
  for (const c of coverage || []) {
    if (c.centerLng == null || c.centerLat == null) continue
    for (const tier of c.tiers || []) {
      const style = TIER_STYLE.find(t => t.seconds === tier.seconds) || TIER_STYLE[0]
      const r = tier.radius || 0
      dataSource.entities.add({
        id: `canteen-tier-${c.canteenId}-${tier.seconds}`,
        position: Cesium.Cartesian3.fromDegrees(c.centerLng, c.centerLat, 0),
        ellipse: {
          semiMajorAxis: r,
          semiMinorAxis: r,
          height: 2, // 贴地（不用 clampToGround，避免 GroundPrimitive 描边渲染问题）
          material: style.color.withAlpha(0.15),
          outline: true,
          outlineColor: style.color.withAlpha(0.7),
          outlineWidth: 1.5
        },
        properties: {
          isCanteenTier: true,
          canteenId: c.canteenId,
          seconds: tier.seconds
        }
      })
    }
  }
  viewer.dataSources.add(dataSource)
  return dataSource
}
```

- [ ] **Step 2: 追加 createDormitoryHighlight**

```js
/**
 * 创建宿舍覆盖高亮（红色标记点 + 名称标签），返回 dataSource 供清除
 */
export function createDormitoryHighlight(viewer, dormList) {
  const dataSource = new Cesium.CustomDataSource('宿舍覆盖高亮')
  for (const d of dormList || []) {
    if (d.lng == null || d.lat == null) continue
    dataSource.entities.add({
      position: Cesium.Cartesian3.fromDegrees(d.lng, d.lat, 30),
      point: {
        pixelSize: 14,
        color: Cesium.Color.RED.withAlpha(0.85),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2
      },
      label: {
        text: d.name,
        font: '12px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.RED,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -20)
      }
    })
  }
  viewer.dataSources.add(dataSource)
  return dataSource
}
```

- [ ] **Step 3: 构建验证**：`npm run build`
- [ ] **Step 4: 提交**：`git add frontend/src/utils/cesium.js; git commit -m "feat(frontend): canteen buffer circles + dorm highlight"`

### Task 6: CesiumViewer 接线（加载 + 点击 + 高亮联动）

**Files:**
- Modify: `frontend/src/components/CesiumViewer.vue`

**Interfaces:**
- Consumes: `getRestaurantCoverage`（Task 4）、`loadCanteenBuffer`/`createDormitoryHighlight`（Task 5）、`mapStore.canteenCoverage/coveragePopup`（Task 4）
- Produces: `dataSources.canteenBuffer`；点击分支；`coveragePopup` 写入；`watch(coveragePopup)` 高亮/清除

- [ ] **Step 1: import**

在 `import { loadRestaurantMarkers ... } from '@/utils/cesium'` 相关 import 行追加 `loadCanteenBuffer, createDormitoryHighlight`；在 `@/api/restaurant` import 追加 `getRestaurantCoverage`。

- [ ] **Step 2: 模块变量 + 高亮管理**

在 `let measureController = null` 附近追加（`clearDormHighlight` 接收 viewer 参数，避免访问组件 setup 作用域）：
```js
let dormHighlight = null // 宿舍覆盖高亮 dataSource
function clearDormHighlight(viewer) {
  if (dormHighlight) {
    viewer.dataSources.remove(dormHighlight)
    dormHighlight = null
  }
}
```

- [ ] **Step 3: loadDeliveryData 内加载缓冲圈**

在"加载餐厅标记" try 块之后追加（同一函数内）：
```js
  // 加载食堂缓冲区覆盖
  try {
    const coverage = await getRestaurantCoverage()
    if (coverage?.length) {
      mapStore.canteenCoverage = coverage
      mapStore.dataSources.canteenBuffer = loadCanteenBuffer(viewer, coverage, '食堂缓冲区')
    }
  } catch (e) { console.warn('加载食堂缓冲区失败:', e) }
```

- [ ] **Step 4: registerClickHandler 拾取分支**

在 `// 无人机点击` 分支（`if (entity.properties?.isDrone?.getValue())`）之后、`// 建筑点击` 之前插入：
```js
      // 食堂缓冲圈：该档覆盖宿舍 + 高亮（高亮由 coveragePopup watch 统一处理）
      if (entity.properties?.isCanteenTier?.getValue()) {
        const canteenId = entity.properties.canteenId?.getValue()
        const seconds = entity.properties.seconds?.getValue()
        const canteen = (mapStore.canteenCoverage || []).find(c => c.canteenId === canteenId)
        const tier = canteen?.tiers?.find(t => t.seconds === seconds)
        if (tier) {
          mapStore.coveragePopup = {
            type: 'tier',
            canteenId,
            canteenName: canteen.name,
            seconds,
            dormitories: tier.dormitories
          }
        }
        return
      }

      // 食堂标记：3 档覆盖概览
      if (entity.properties?.isRestaurant?.getValue()) {
        const canteen = (mapStore.canteenCoverage || []).find(
          c => c.canteenId === entity.properties.id?.getValue()
        )
        if (canteen) {
          mapStore.coveragePopup = {
            type: 'overview',
            canteenId: canteen.canteenId,
            canteenName: canteen.name
          }
        }
        return
      }
```

- [ ] **Step 5: 点击空白清除浮窗**

在 `// 点击空白处，清除选中` 分支 `mapStore.clearSelection()` 后追加：
```js
    mapStore.coveragePopup = null
```

- [ ] **Step 6: watch coveragePopup 统一高亮**

在 `setupMeasure` 调用附近（onMounted 内）追加：
```js
  // 覆盖浮窗联动：tier 视图高亮宿舍，关闭清除
  watch(() => mapStore.coveragePopup, (v) => {
    clearDormHighlight(viewer)
    if (v?.type === 'tier' && v.dormitories?.length) {
      dormHighlight = createDormitoryHighlight(viewer, v.dormitories)
    }
  })
```

- [ ] **Step 7: 构建验证**：`npm run build`
- [ ] **Step 8: 提交**：`git add frontend/src/components/CesiumViewer.vue; git commit -m "feat(frontend): load buffer circles, click overview/tier, highlight dormitories"`

### Task 7: 覆盖浮窗组件 + App 挂载 + 图例

**Files:**
- Create: `frontend/src/components/CanteenCoveragePanel.vue`
- Modify: `frontend/src/App.vue`

**Interfaces:**
- Consumes: `mapStore.coveragePopup`、`mapStore.canteenCoverage`（Task 4）
- Produces: 组件 + 图例（v-if `layers.canteenBuffer && canteenCoverage`）

- [ ] **Step 1: 创建 CanteenCoveragePanel.vue**

```vue
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
          <span class="cp-item-meta">{{ fmtM(d.distanceM) }} · {{ d.seconds }}s</span>
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
  const c = (mapStore.canteenCoverage || []).find(x => x.canteenId === popup.value?.canteenId)
  return c?.tiers || []
})

function showTier(t) {
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
  top: 120px;
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
```

- [ ] **Step 2: App.vue 挂载组件 + 图例**

- import：`import CanteenCoveragePanel from '@/components/CanteenCoveragePanel.vue'`
- 在 `.map-container` 内（`<MeasureInfo/>` 挂载容器附近）追加：`<CanteenCoveragePanel />`
- 追加图例（地图左下角，`.measure-info-slot` 之外）：
```html
        <div v-if="mapStore.layers.canteenBuffer && mapStore.canteenCoverage" class="coverage-legend">
          <div class="cl-item"><span class="cl-dot" style="background:#2ECC40"></span>30s · 150m</div>
          <div class="cl-item"><span class="cl-dot" style="background:#FF851B"></span>60s · 300m</div>
          <div class="cl-item"><span class="cl-dot" style="background:#FF4136"></span>90s · 450m</div>
          <div class="cl-note">圆=时间参考线 · 高亮点=实际覆盖宿舍</div>
        </div>
```
- 样式追加：
```css
.coverage-legend {
  position: absolute; left: 16px; bottom: 120px; z-index: 11;
  background: rgba(20, 30, 48, 0.9); border-radius: 8px; padding: 8px 12px;
  color: #fff; font-size: 12px; pointer-events: none;
}
.cl-item { display: flex; align-items: center; gap: 6px; line-height: 1.8; }
.cl-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.cl-note { color: rgba(255,255,255,0.55); margin-top: 4px; font-size: 11px; }
```
- 若 App.vue 未在 script 中定义 `mapStore`（模板直接使用），需在 script setup 中 `const mapStore = useMapStore()`（若已存在则复用）。

- [ ] **Step 3: 构建验证**：`npm run build`
- [ ] **Step 4: 提交**：`git add frontend/src/components/CanteenCoveragePanel.vue frontend/src/App.vue; git commit -m "feat(frontend): coverage popup panel + legend"`

### Task 8: 全量验证与收尾

**Files:** 无（验证与提交）

- [ ] **Step 1: 后端编译 + 启动联调**

- `mvn -q compile` 通过；
- 启动后端（若已停）→ `Invoke-RestMethod http://localhost:8080/api/restaurant/coverage` 返回 2 食堂 × 3 档；结束进程（若原在跑则保留）。

- [ ] **Step 2: 前端构建**：`npm run build` 0 错误
- [ ] **Step 3: 手动清单（交付用户验证）**

1. 图层面板"食堂缓冲区"开关默认开，关闭后圈消失、图例消失；
2. 每个食堂 3 层同心圈（绿/橙/红 = 150/300/450m），圆心在食堂标记处；
3. 点击食堂标记 → 浮窗 3 档概览（覆盖栋数）；点击档位行 → 该档宿舍清单 + 宿舍高亮；
4. 点击缓冲圈 → 直接该档清单 + 高亮；点击空白/关闭 → 浮窗关闭 + 高亮清除；
5. 覆盖宿舍数与圈内宿舍可能有差异（导航绕行）——图例已说明；
6. 无人机/航线/测量/其他图层开关不受影响。

- [ ] **Step 4: 收尾提交**：验证中发现的问题修复后提交；最后 `git status` 确认工作区干净
