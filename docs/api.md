# API 接口文档

> 基础地址：`http://localhost:8080`
> 统一响应格式：`{ "code": 200, "message": "success", "data": ... }`
> Swagger 在线文档：`http://localhost:8080/swagger-ui.html`

---

## 一、空间查询接口

### 1.1 获取所有图层元数据

- **URL**: `GET /api/spatial/layers`
- **说明**: 返回所有空间数据表的元信息（表名、中文名、类型、记录数、是否有高度字段）
- **响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "tableName": "teaching_building",
      "label": "教学楼",
      "geometryType": "polygon",
      "count": 7,
      "hasHeight": true
    }
  ]
}
```

### 1.2 点选查询

- **URL**: `GET /api/spatial/point-query`
- **参数**:
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | table | string | 是 | 表名（白名单内） |
  | lng | double | 是 | 经度 |
  | lat | double | 是 | 纬度 |
- **说明**: 查询指定坐标点落在哪个要素上（ST_Intersects）
- **响应示例**:
```json
{
  "code": 200,
  "data": {
    "id": 1,
    "name": "1号教学楼",
    "height": 6,
    "shape_area": 0.0000025,
    "geom": "{\"type\":\"Polygon\",\"coordinates\":[...]}"
  }
}
```

### 1.3 缓冲区查询

- **URL**: `GET /api/spatial/buffer`
- **参数**:
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | table | string | 是 | 表名 |
  | lng | double | 是 | 经度 |
  | lat | double | 是 | 纬度 |
  | radius | double | 否 | 半径（米），默认100 |
- **说明**: 查询指定半径范围内的所有要素，按距离升序（ST_DWithin + ST_Distance）
- **响应**: 要素列表，每个要素含 `distance_m` 字段

### 1.4 按表名获取 GeoJSON

- **URL**: `GET /api/spatial/geojson/{table}`
- **参数**: `table` - 表名（路径参数）
- **说明**: 返回整表数据，geom 字段为 GeoJSON 字符串（ST_AsGeoJSON）
- **响应**: 要素数组

### 1.5 根据 ID 查询要素详情

- **URL**: `GET /api/spatial/building/{table}/{id}`
- **参数**: `table` 表名，`id` 要素 ID
- **响应**: 单个要素详情，含 centroid 中心点

### 1.6 获取校园边界和中心点

- **URL**: `GET /api/spatial/campus-bounds`
- **说明**: 从 school 表获取校园范围（ST_Extent + ST_Centroid）
- **响应示例**:
```json
{
  "minx": 114.45,
  "miny": 38.03,
  "maxx": 114.48,
  "maxy": 38.05,
  "center_lng": 114.465,
  "center_lat": 38.04,
  "area_sqm": 520000
}
```

---

## 二、MVT 矢量瓦片接口

### 2.1 获取矢量瓦片

- **URL**: `GET /tiles/{table}/{z}/{x}/{y}.mvt`
- **参数**:
  | 参数 | 类型 | 说明 |
  |------|------|------|
  | table | string | 表名 |
  | z | int | 缩放级别（0-22） |
  | x | int | 瓦片 X 坐标 |
  | y | int | 瓦片 Y 坐标 |
- **Content-Type**: `application/x-protobuf`
- **说明**: 利用 PostGIS 原生 `ST_TileEnvelope` + `ST_AsMVTGeom` + `ST_AsMVT` 生成 Mapbox Vector Tile 格式二进制数据
- **缓存**: `Cache-Control: public, max-age=3600`

---

## 三、模拟物联网接口

> MVP 阶段全部为内存模拟数据，设备点位基于校园边界随机生成

### 3.1 获取设备列表

- **URL**: `GET /api/iot/devices`
- **参数**: `type`（可选）- 设备类型：camera / streetlight / smoke / energy
- **响应示例**:
```json
{
  "data": [
    {
      "id": "camera-001",
      "name": "摄像头-1号",
      "type": "camera",
      "typeLabel": "摄像头",
      "lng": 114.465,
      "lat": 38.04,
      "online": true,
      "location": "教学楼A座入口"
    }
  ]
}
```

### 3.2 获取设备实时数据

- **URL**: `GET /api/iot/device/{id}/realtime`
- **响应**: 温度、湿度、能耗、烟雾浓度等模拟数据

### 3.3 获取告警列表

- **URL**: `GET /api/iot/alerts`
- **说明**: 随机生成 1-3 条告警（火警/离线/异常/故障）

### 3.4 获取设备统计

- **URL**: `GET /api/iot/stats`
- **响应**: 总数、在线数、离线数、告警数、按类型分组

---

## 四、统计接口

### 4.1 校园概览统计

- **URL**: `GET /api/stat/overview`
- **响应示例**:
```json
{
  "data": {
    "buildingCount": 28,
    "buildingArea": 45000.5,
    "avgFloors": 5.8,
    "maxFloors": 8,
    "roadCount": 29,
    "roadLength": 3200.5,
    "venueCount": 4,
    "centerLng": 114.465,
    "centerLat": 38.04,
    "campusArea": 520000
  }
}
```

---

## 附录：允许的表名白名单

| 表名 | 中文名 | 类型 | 有height |
|------|--------|------|----------|
| school | 校园边界 | polygon | 否 |
| teaching_building | 教学楼 | polygon | 是 |
| dormitory | 宿舍楼 | polygon | 是 |
| other_buildings | 其他建筑 | polygon | 是 |
| road | 道路 | line | 否 |
| playground | 操场 | polygon | 否 |
| basketball_court | 篮球场 | polygon | 否 |
| tennis_court | 网球场 | polygon | 否 |

> 所有动态表名接口均校验白名单，防止 SQL 注入。
