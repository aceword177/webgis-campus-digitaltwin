# 校园无人机外卖配送系统 — Bug 排查报告与修改方案（2026-09-11）

> 说明：本文件为静态代码审查产物（未修改任何源码时的方案稿），随后按批次实施。
> 审查范围：frontend/src 全部 20 个源文件、backend/src 核心 Service/Controller/Mapper/XML、docs/sql。
> 审查方式：全量读代码 + 前后端契约交叉核对 + 距离口径数学验证（3857 在 38°N 放大约 1/cos(38°)≈1.27 倍）。

## 一、Bug 清单总览

| 编号 | 级别 | 问题 | 位置 |
|---|---|---|---|
| B1 | P0 | 飞行航线/宿舍楼标记图层开关点了没反应 | LayerPanel.vue / map.js / CesiumViewer.vue |
| B2 | P0 | 距离/时长三套口径（3857/haversine/直线半径）不一致 | NavigationMapper / DroneServiceImpl / RestaurantServiceImpl |
| B3 | P0 | 派单并发无锁，无人机可被同时派给两单 | AutoOrderScheduler / OrderServiceImpl.confirmDeliver |
| B4 | P0 | 动画手动停止后 checkFinish 定时器泄漏 | CesiumViewer.vue |
| B5 | P0 | 起终点同一网格节点时航线规划越界崩溃 | RouteServiceImpl / OrderServiceImpl.saveRoute |
| B6 | P1 | extractCentroid 静默兜底到校园外 2km 坐标 | OrderServiceImpl |
| B7 | P1 | 食堂覆盖浮窗与圆圈高亮联动不一致 | CesiumViewer.vue / CanteenCoveragePanel.vue |
| B8 | P1 | 建筑弹窗面积/周长硬编码近似，误差约 12% | BuildingPopup.vue |
| B9 | P1 | 校园面积统计 = 外接矩形面积（ST_Extent） | SpatialQueryMapper.xml |
| B10 | P2 | 订单号同秒随机数碰撞 | OrderServiceImpl / AutoOrderScheduler |
| B11 | P2 | CORS 全放开 + 允许凭证 | CorsConfig |
| B12 | P2 | 数据库口令明文 | application.yml |
| B13 | P2 | MVT 瓦片/缓冲区查询前端未闭环（死功能） | TileController / BuildingPopup.queryBuffer |
| B14 | P2 | 动画停止后 viewer.clock 状态未复位 | cesium.js createDroneAnimation |
| B15 | P2 | DronePanel 刷新按钮误触发 loading | DronePanel.vue |

## 二、修改方案（M1–M12 本次实施；M13 可立项）

### M1（B1）图层开关
- `stores/map.js` `setLayerVisible`：特判 `routes`，遍历以 `route-` / `order-route-` 开头的 dataSource 统一显隐。
- `CesiumViewer.loadDeliveryData`：调用 `loadDormitoryMarkers` 创建宿舍楼标记数据源并存入 store。
- `utils/cesium.js` `loadDormitoryMarkers`：修复 Polygon/MultiPolygon 质心提取（原实现只认 LineString/centroid 字段，面要素必然被跳过）。

### M2（B2）距离口径统一
- `NavigationMapper.buildRouteFromNodes`：`ST_Length(...)` 改为 `ST_Length(ST_MakeLine(...)::geography)`（真实球面米）。
- `SpatialQueryMapper.xml`：`selectByBuffer` / `selectDistanceToFeature` 由 3857 改 geography；`selectBuildingStats` / `selectRoadStats` 同样改 geography。
- 影响面：`estimated_seconds`、自动确认送达时刻、食堂覆盖分档全部回到真实米口径，与无人机 haversine 推进一致。

### M3（B3）派单加锁
- `DeliveryOrderMapper` 新增 `selectByIdForUpdate`，`DroneMapper` 新增 `selectByIdForUpdate` + `selectAvailableForUpdate`（`FOR UPDATE`）。
- `OrderServiceImpl.assignDrone`：订单行、无人机行均走加锁查询，锁在事务内持有至提交，消除双派。

### M4（B4）动画定时器生命周期
- `CesiumViewer.vue`：`checkFinish` 句柄提升为模块级，`onStopAnimation` / `onOrderDelivered` / 卸载时统一清理。

### M5（B5）单节点路径防御
- `RouteServiceImpl.plan`：`buildRouteFromNodes` 后校验 routeGeojson 非空且 waypoints ≥ 2，否则抛"起终点过近/不可达"。

### M6（B6）extractCentroid 改抛错
- `OrderServiceImpl.extractCentroid`：解析失败改为抛 `IllegalArgumentException`，删除校园外远点兜底。

### M7（B7）覆盖浮窗联动
- 点食堂标记：同时写 `canteenActiveSelection={type:'canteen'}`。
- `CanteenCoveragePanel.showTier`：同时写 `canteenActiveSelection={type:'tier'}`，与查询面板一致。

### M8（B8/B9）精度
- `SpatialQueryMapper.xml`：点选/整表/详情 SQL 增加 `perimeter_m`（ST_Length::geography）、`area_sqm`（ST_Area::geography）；`selectCampusBounds` 面积改为 `SUM(ST_Area(geom::geography))`。
- `BuildingPopup.vue`：优先展示后端返回的米/平方米字段。

### M9–M12（P2）
- 订单号后缀改 UUID 片段；CORS 收敛到 localhost:5173；DronePanel 刷新改 `loadDrones(false)`；动画 stop 时复位 clock。

### M13（可立项，未实施）
- MVT 瓦片接入 Cesium、缓冲区查询 UI 闭环。

## 三、验证方式
- 前端 `npm run build`；后端 `mvn compile`（IDEA 自带 JDK）。
- SQL 用 psql 对 `shp_data` 做只读抽查（geography 函数可执行）。
- 浏览器实测：图层开关、动画停止、覆盖浮窗联动。
