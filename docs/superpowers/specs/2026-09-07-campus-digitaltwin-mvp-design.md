# 校园数字孪生 WebGIS MVP 项目设计文档

> 日期：2026-09-07
> 目标：就业 WebGIS 工程师的可运行项目
> 范围：MVP 核心链路（数据层 + 后端服务层 + 前端可视化层）

## 1. 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 前端 | Vue3 + Vite + Cesium + Element-Plus + Pinia | Vue 3.4 / Vite 5 / Cesium 1.114 / Element-Plus 2.5 |
| 后端 | Spring Boot + MyBatis-Plus + HikariCP | Spring Boot 3.2 / Java 17 / MyBatis-Plus 3.5 |
| 数据库 | PostgreSQL + PostGIS | PostgreSQL 18 |
| 坐标系统 | 入库统一标注 WGS84 (SRID 4326) | — |
| 坐标基准 | 数据实际为高德 GCJ-02 基准（`.prj` 标注 `GCS_WGS_1984` 与实体不符）；底图取同基准高德影像零平移，实测与 WGS84 底图偏差约 109m | — |
| 空间数据来源 | ArcMap 依影像底图手工矢量化 8 图层 / 62 要素 → 导出 Shapefile → 导入 PostGIS | — |

## 2. 项目结构

```
webgis-campus-digitaltwin-mvp/
├── backend/          # Spring Boot 后端
├── frontend/         # Vue3 前端
├── docs/             # 项目文档
└── README.md
```

## 3. 数据库表结构（已有）

| 表名 | 记录数 | 类型 | 关键字段 |
|------|--------|------|----------|
| school | 1 | 校园边界面 | geom, SHAPE_Leng, SHAPE_Area |
| teaching_building | 7 | 教学楼面 | geom, name, height(6-8) |
| dormitory | 10 | 宿舍楼面 | geom, name, height(6-8) |
| other_buildings | 11 | 其他建筑面 | geom, name, height(1-7) |
| road | 29 | 道路线 | geom, name, SHAPE_Leng |
| playground | 2 | 操场面 | geom, name |
| basketball_court | 1 | 篮球场面 | geom, name |
| tennis_court | 1 | 网球场面 | geom, name |

## 4. 后端接口设计

### 4.1 空间查询接口 `/api/spatial/*`

- `GET /api/spatial/buildings` — 获取所有建筑列表（GeoJSON）
- `GET /api/spatial/building/{id}` — 根据ID查单个建筑详情
- `GET /api/spatial/point-query` — 坐标点选查询
- `GET /api/spatial/buffer` — 缓冲区查询（周边要素）
- `GET /api/spatial/layers` — 获取所有图层元数据
- `GET /api/spatial/geojson/{table}` — 按表名输出完整GeoJSON

### 4.2 MVT 瓦片接口

- `GET /tiles/{table}/{z}/{x}/{y}.mvt` — PostGIS 原生 ST_AsMVT 输出矢量瓦片

### 4.3 模拟物联网接口 `/api/iot/*`

- `GET /api/iot/devices` — 设备列表（摄像头/路灯/烟感/能耗）
- `GET /api/iot/device/{id}/realtime` — 单设备实时数据（模拟）
- `GET /api/iot/alerts` — 当前告警列表
- `GET /api/iot/stats` — 设备统计

### 4.4 统计接口

- `GET /api/stat/overview` — 校园概览统计

## 5. 前端模块设计

### 5.1 CesiumViewer 三维场景核心

- 建筑白模拉伸（height × 3.5米/层），按类型着色
- 道路线渲染、场地半透明面渲染、校园边界描边
- 点击拾取 → 点选查询 → 建筑属性弹窗

### 5.2 组件清单

- `CesiumViewer.vue` — 三维场景
- `LayerPanel.vue` — 图层控制面板
- `BuildingPopup.vue` — 建筑点击弹窗
- `MeasureTool.vue` — 测距/测面积工具
- `StatPanel.vue` — 统计面板

### 5.3 状态管理（Pinia）

图层显隐、选中建筑、测量模式、校园中心点、Viewer 实例。

## 6. 数据层设计

- 空间字段 geom 用 String 接收（ST_AsGeoJSON 转换）
- 8 个实体类继承 BaseSpatialEntity
- 建筑类实现 BuildingInfo 接口（统一 getHeight）
- MVT 瓦片返回 byte[]，Content-Type: application/x-protobuf
- 统一响应格式 {code, message, data}
- 全局异常处理 + CORS 配置 + Swagger 文档

## 7. 扩展方向（后续迭代）

- 仿真业务层：消防疏散模拟、日照仿真、设备告警模拟
- 部署层：Nginx 反向代理 + 静态资源托管
- 真实 IoT 设备接入（InfluxDB 时序库）
- 倾斜摄影 OSGB / BIM glb 模型加载
