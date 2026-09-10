# 食堂缓冲区辐射范围设计

> 日期：2026-09-10
> 状态：已获用户逐节批准（节 1~4）
> 目标：在地图上展示每个食堂的 3 档配送缓冲圈（30s/60s/90s），按**导航路径时间**（非直线）判定覆盖宿舍；点击食堂标记查看 3 档概览，点击缓冲圈查看该档覆盖宿舍清单并高亮

## 0. 背景与已确认决策

- 用户设计思路：设置 3 个不同大小的食堂缓冲区，按无人机从食堂派送订单到宿舍的**时间**划分；缓冲区越大，辐射宿舍越多、配送时间越长。
- 已确认决策：
  1. 时间档：**30s / 60s / 90s**（无人机速度 5m/s → 圆形参考半径 150m / 300m / 450m）；
  2. 呈现：**地图图层 + 点击查看**（图层面板新增开关）；
  3. 点击：食堂标记=3 档概览；某层缓冲圈=该档宿舍清单 + 高亮（方案 c）；
  4. 实现：**后端接口**（导航路径时间，非直线）；
  5. 圈形：**圆形示意圈 + 实际覆盖宿舍高亮**（圈=时间参考线，点=实情）。

## 1. 设计节 1：后端覆盖计算接口

### 1.1 接口
`GET /api/restaurant/coverage`（挂 RestaurantController）

### 1.2 响应结构
```json
{
  "code": 0,
  "data": [
    {
      "canteenId": 1, "name": "食堂1",
      "centerLng": 114.4704, "centerLat": 37.98318,
      "tiers": [
        { "seconds": 30, "radius": 150, "dormitories": [ { "id": 3, "name": "2号宿舍楼", "distanceM": 128, "seconds": 26 } ] },
        { "seconds": 60, "radius": 300, "dormitories": [ "≤60s 全部（含30s档）" ] },
        { "seconds": 90, "radius": 450, "dormitories": [ "≤90s 全部" ] }
      ]
    }
  ]
}
```
- **覆盖语义**：每档 = 累积覆盖（导航路径时间 ≤ 该档秒数的全部宿舍，按 seconds 升序）；
- `radius` = `seconds × 5.0`（圆形示意半径，前端渲染用）；
- `seconds` = `ceil(distanceM / 5.0)`。

### 1.3 计算逻辑（与现有航线规划同口径）
1. 食堂中心：复用 `RestaurantService.getRestaurantDetail` 的 `centerLng/centerLat`（other_buildings 质心）；
2. 宿舍中心：新增 SQL——`dormitory` 表 `ST_Centroid(geom)`（10 栋）；
3. 每个食堂 × 每栋宿舍：
   - `NavigationMapper.findNearestWalkableNode(centerLng, centerLat)` → 起/终点节点；
   - `findShortestPath(startNodeId, endNodeId)`（pgr_astar）；
   - `buildRouteFromNodes(nodeIds)` → `distance_m`；
   - `seconds = ceil(distance_m / 5.0)`；
4. **不可达**（A* 无路径）→ 该宿舍不计入任何档；
5. 分档：seconds ≤ 30 / ≤60 / ≤90 累积归入对应档。

### 1.4 改动清单
- `RestaurantServiceImpl` 新增 `getCoverage()`：注入 `NavigationMapper`，复用现有 3 个查询方法；新增宿舍中心查询（`DormitoryMapper` 或 NavigationMapper 加 `findDormitoryCentroids()`）；
- 新增 DTO：`CanteenCoverageVO`（canteenId/name/centerLng/centerLat/tiers）、`TierCoverageVO`（seconds/radius/dormitories）、`DormitoryCoverageVO`（id/name/distanceM/seconds）；
- `RestaurantController` 新增 GET `/coverage`；
- 性能：2 食堂 × 10 宿舍 = 20 次 A*，校园小网格毫秒级，无需缓存。

## 2. 设计节 2：前端缓冲圈渲染

- 新图层：`map.js` `layers.canteenBuffer`（默认 true）+ `dataSources.canteenBuffer`（CustomDataSource），复用 `setLayerVisible` 机制；
- 加载：`CesiumViewer.loadDeliveryData` 内调用 `getRestaurantCoverage()` 后渲染（`utils/cesium.js` 新增 `loadCanteenBuffer(viewer, coverage, name)`）：
  - 每个食堂 3 层同心 `entity.ellipse`（贴地，semiMajorAxis = semiMinorAxis = radius）：
    - 30s/150m：绿色（material α0.15 + 描边）
    - 60s/300m：橙色（α0.12）
    - 90s/450m：红色（α0.10）
  - ellipse 带 `properties: { isCanteenTier: true, canteenId, seconds }`（供点击识别）；
  - 圈上不写文字，时间/半径由图例与浮窗说明；
- 覆盖宿舍**不高亮常驻**，仅点击时临时高亮（节 3）。

## 3. 设计节 3：点击交互

| 点击目标 | 行为 |
|---|---|
| 食堂标记（`properties.isRestaurant`） | 浮窗显示该食堂 3 档覆盖概览（每档宿舍数，可展开宿舍名+距离+预计秒） |
| 缓冲圈（`properties.isCanteenTier`） | 浮窗显示该档覆盖宿舍清单（名+距离+预计秒，按时间升序）+ **临时高亮**宿舍（红色标记点+宿舍名标签） |
| 空白 / 关闭浮窗 | 关闭浮窗 + 清除高亮 |

- 实现：`CesiumViewer.registerClickHandler` 现有拾取逻辑扩展分支（isRestaurant / isCanteenTier），高亮用临时 entity 集合（`utils/cesium.js` 新增 `highlightDormitories(viewer, dormList, ...)` / `clearDormitoryHighlight()`），不修改宿舍原图层实体；
- 浮窗状态写入 `mapStore.coveragePopup`。

## 4. 设计节 4：UI 浮窗与图例

- 新组件 `CanteenCoveragePanel.vue`：自绘深色半透明卡片（与现有面板风格统一），地图内浮窗；数据来自 `mapStore.coveragePopup` + 接口数据缓存（`mapStore.canteenCoverage`）；
  - 概览视图：食堂名 + 3 档（"30s · N 栋"等，可展开宿舍明细）；
  - 档位视图：标题（食堂名 + 时间档）+ 宿舍清单（名+距离+预计秒）+ 高亮；
  - 关闭按钮 → 清浮窗 + 清高亮；
- 图例：地图左下角小图例——3 色圆 + "30s·150m / 60s·300m / 90s·450m" + 说明"圆=时间参考，高亮点=实际覆盖"；
- `frontend/src/api/restaurant.js` 新增 `getRestaurantCoverage()`。

## 5. 验证方式

- 后端：`mvn compile` 通过；`curl http://localhost:8080/api/restaurant/coverage` 返回 2 食堂 × 3 档结构，宿舍 seconds 与 pgr_astar 路径一致（抽查 1~2 个宿舍用 psql 复算）；
- 前端：`npm run build` 通过；
- 手动清单（用户浏览器验证）：
  1. 图层面板"食堂缓冲区"开关默认开，关闭后圈消失；
  2. 每个食堂 3 层同心圈（绿/橙/红），圆心在食堂标记处；
  3. 点击食堂标记 → 3 档概览（宿舍数正确，与后端数据一致）；
  4. 点击某层圈 → 该档宿舍清单 + 宿舍高亮；点击空白/关闭 → 高亮清除；
  5. 覆盖宿舍数与"圆内宿舍"可能有差异（导航绕行）——图例已说明；
  6. 与既有功能不冲突（无人机、航线、测量、图层开关）。

## 6. 风险与兼容

- **覆盖与圆形参考线的差异**：导航路径时间可能大于直线时间（绕行限飞区/建筑），圈内宿舍可能不在档内、圈外宿舍可能在档内——按用户确认以"高亮点"表达实际覆盖，圈仅作时间参考；
- 宿舍中心用质心（`ST_Centroid`），接入点取最近导航节点（与航线规划一致）；
- 不新增第三方依赖；
- 后端接口失败时前端降级：缓冲图层不渲染，图例不显示，控制台 warn（与现有加载模式一致）。

## 7. 已验证事实

- 数据库：`restaurant`（2 个，无 geom，building_id 关联 other_buildings 4/7）、`dormitory`（10 栋，有 geom 列）、`drone_nav_node/edge`（导航网格）；
- 食堂中心：other_buildings id=4（114.470403,37.983182）、id=7（114.470423,37.985102）；宿舍中心见 psql `ST_Centroid(geom)` 查询结果；
- 无人机速度：`RouteServiceImpl.FLIGHT_SPEED = 5.0 m/s`（与 DroneServiceImpl 一致）；
- 导航口径：`findNearestWalkableNode(lng,lat)` + `findShortestPath(start,end)`（pgr_astar）+ `buildRouteFromNodes(nodeIds)` → `distance_m`；`estimatedSeconds = ceil(distanceM / 5.0)`（RouteServiceImpl Step 5/7）；
- 前端：`layers/dataSources` 机制、`setLayerVisible`、食堂标记 entity（`id: 'restaurant-'+id`、`properties.isRestaurant`）、`registerClickHandler` 拾取分支结构均已核实；
- `RestaurantDetailVO` 含 `centerLng/centerLat/buildingGeojson`；前端 `getRestaurants/getRestaurantDetail` 已存在。
