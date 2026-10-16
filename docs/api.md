# API 接口文档

> 基础地址：`http://localhost:8080`
> 统一响应格式：`{ "code": 200, "message": "success", "data": ... }`
> Swagger 在线文档：`http://localhost:8080/swagger-ui.html`

---

## 一、空间查询接口

### 1.1 获取所有图层元数据

- **URL**: `GET /api/spatial/layers`
- **说明**: 返回所有空间数据表的元信息（表名、中文名、类型、记录数、是否有高度字段）
- **`count` 字段的三种取值**（2026-10-16 起，见 `bug档案-04`）：
  | 值 | 含义 |
  |---|---|
  | 非负整数 | 该表当前记录数（**确认值**） |
  | `null` | **该层存在，但记录数未知**——启动时这一张表的 `COUNT` 查询失败（如表未建）。此时**不会**中断启动，只记 WARN |
  | （整层缺失） | 不再发生。修复前查询失败会让该层**从数组里消失**，调用方无法与"这层本来就没有"区分 |
  > 另：若**八张表全部**查询失败（= 数据库不可用），应用会**拒绝启动**并抛 `IllegalStateException`，因此不会再出现 `HTTP 200 + data: []` 这种"假成功"。
- **响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "table_name": "teaching_building",
      "label": "教学楼",
      "geometry_type": "polygon",
      "count": 7,
      "has_height": true
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
    "name": "6号教学楼",
    "height": 6,
    "dept_name": "商学院",
    "description": "商学院立足区域经济发展，设有工商管理、市场营销、会计学等专业……",
    "shape_area": 0.0000025,
    "perimeter_m": 202.45,
    "area_sqm": 1637.46,
    "geom": "{\"type\":\"MultiPolygon\",\"coordinates\":[...]}"
  }
}
```

**建筑业务属性字段**（点击建筑弹窗的数据来源，按表名条件返回，其他表不带）：

| 字段 | 表 | 说明 |
|------|------|------|
| `dept_name` | teaching_building | 所属院系 |
| `description` | teaching_building | 学院简介 |
| `gender` | dormitory | 宿舍性别：男 / 女 |

> 建筑照片不走接口字段，前端按 `frontend/public/buildings/{表名}-{id}.jpg` 约定取图，
> 缺图自动回退占位图。详见 `frontend/public/buildings/README.md`。

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
- **响应**: 单个要素详情，含 centroid 中心点；建筑表附带 `dept_name` / `description` / `gender`（同 1.2 的字段表）

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

## 三、统计接口

### 3.1 校园概览统计

- **URL**: `GET /api/stat/overview`
- **响应示例**:
```json
{
  "data": {
    "building_count": 28,
    "building_area": 45000.5,
    "avg_floors": 5.8,
    "max_floors": 8,
    "road_count": 29,
    "road_length": 3200.5,
    "venue_count": 4,
    "center_lng": 114.465,
    "center_lat": 38.04,
    "campus_area": 520000
  }
}
```

---

## 四、配送业务接口

> 无人机外卖配送业务，含订单、无人机、航线、限飞区、餐厅、商品六组接口。
> 注意：后端全局 `SNAKE_CASE` 序列化，所有请求体与响应字段均为下划线命名。

### 4.1 无人机管理

#### 4.1.1 无人机列表

- **URL**: `GET /api/drone/list`
- **参数**: `status`（可选）- 状态过滤：idle / delivering / charging / maintenance
- **响应示例**:
```json
{
  "code": 200,
  "data": [
    {
      "id": 1,
      "drone_no": "UAV-001",
      "model": "DJI Matrice 30",
      "max_payload_kg": 2.0,
      "max_range_km": 5.0,
      "battery_pct": 100,
      "status": "idle",
      "current_lng": 114.470404,
      "current_lat": 37.983182,
      "last_update_time": "2026-09-10T10:00:00",
      "create_time": "2026-09-08T09:00:00"
    }
  ]
}
```

#### 4.1.2 无人机详情

- **URL**: `GET /api/drone/{id}`
- **响应**: 单个无人机对象（字段同上）

#### 4.1.3 无人机状态统计

- **URL**: `GET /api/drone/stats`
- **响应示例**:
```json
{
  "data": {
    "total": 10,
    "idle": 6,
    "delivering": 2,
    "charging": 2,
    "maintenance": 0,
    "avg_battery": 72.5,
    "by_status": { "idle": 6, "delivering": 2, "charging": 2 }
  }
}
```

#### 4.1.4 更新无人机位置和电量（模拟实时上报）

- **URL**: `POST /api/drone/{id}/update-position`
- **参数**: `lng`（必填）、`lat`（必填）、`battery`（可选）
- **说明**: 模拟无人机实时上报位置/电量，写入数据库

### 4.2 订单管理

订单状态机：`pending(待接单)` → `assigned(已分配)` → `delivering(配送中)` → `delivered(已送达)` / `cancelled(已取消)`。

#### 4.2.1 订单列表

- **URL**: `GET /api/order/list`
- **参数**: `status`（可选）、`page`（默认1）、`size`（默认20）
- **响应示例**:
```json
{
  "code": 200,
  "data": [
    {
      "id": 1,
      "order_no": "DD20260910103000123",
      "restaurant_id": 1,
      "restaurant_name": "一食堂",
      "dormitory_id": 1,
      "dormitory_name": "1号宿舍楼",
      "items_text": "黄焖鸡米饭×1、冰可乐×1",
      "amount": 25.5,
      "status": "delivering",
      "drone_id": 3,
      "create_time": "2026-09-10T10:30:00",
      "assign_time": "2026-09-10T10:31:00",
      "deliver_time": null,
      "remark": null
    }
  ]
}
```

#### 4.2.2 订单详情（含餐厅/宿舍楼/无人机/航线）

- **URL**: `GET /api/order/{id}`
- **响应**: 订单字段 + `restaurant_name`、`dormitory_name`、`drone_no`、`status_label`、`route`（航线信息：route_id、route_geojson、distance_m、estimated_seconds、altitude_m、status）

#### 4.2.3 创建订单

- **URL**: `POST /api/order/create`
- **请求体**:
```json
{
  "restaurant_id": 1,
  "dormitory_id": 3,
  "items_text": "麻辣香锅×1、米饭×2",
  "amount": 32.0,
  "receiver_name": "张三",
  "receiver_phone": "13800000000",
  "remark": "少辣"
}
```

#### 4.2.4 分配无人机（自动调度 + 航线规划）

- **URL**: `POST /api/order/{id}/assign`
- **参数**: `droneId`（可选，不传则自动选择空闲且电量>30%的无人机）
- **说明**: 分配后自动规划 A* 航线（避限飞区）、订单转 `delivering`、无人机转 `delivering`

#### 4.2.5 确认送达

- **URL**: `POST /api/order/{id}/deliver`
- **说明**: 校验无人机距收货宿舍楼 ≤ 30 米后才允许送达；送达后自动处理无人机续派/充电

#### 4.2.6 取消订单

- **URL**: `POST /api/order/{id}/cancel`
- **参数**: `reason`（可选）
- **说明**: 已送达/已取消订单不可取消；取消时释放配送中的无人机

#### 4.2.7 配送统计

- **URL**: `GET /api/order/stats`
- **响应示例**:
```json
{
  "data": {
    "today_orders": 12,
    "today_delivered": 9,
    "today_delivering": 2,
    "today_pending": 1,
    "delivery_rate": 0.75,
    "avg_delivery_minutes": 4.5,
    "order_status_count": { "delivered": 9, "delivering": 2, "pending": 1 },
    "orders_by_restaurant": { "一食堂": 7, "二食堂": 5 }
  }
}
```

### 4.3 航线规划

#### 4.3.1 规划航线（核心算法：pgr_astar 最短路径 + 限飞区边级避让）

- **URL**: `POST /api/route/plan`
- **请求体**:
```json
{
  "start_lng": 114.470404,
  "start_lat": 37.983182,
  "end_lng": 114.475000,
  "end_lat": 37.986000,
  "altitude": 50
}
```
- **响应示例**:
```json
{
  "code": 200,
  "data": {
    "route_geojson": "{\"type\":\"LineString\",\"coordinates\":[[...]]}",
    "waypoints": [[114.470404, 37.983182], [114.472, 37.9845], [114.475, 37.986]],
    "waypoints_count": 18,
    "distance_m": 620.4,
    "estimated_seconds": 124,
    "altitude_m": 50.0,
    "start_node_id": 1024,
    "end_node_id": 3056,
    "avoided_no_fly_zone": true,
    "straight_line_cross_zone": true,
    "route_still_cross_zone": false,
    "crossed_zones": [
      { "id": 1, "name": "图书馆禁飞区", "level": "strict" }
    ]
  }
}
```
- **字段说明**:
  | 字段 | 说明 |
  |------|------|
  | `avoided_no_fly_zone` | 是否成功避让限飞区（直线穿越且路径不穿越 = true） |
  | `straight_line_cross_zone` | 起终点直线是否穿越限飞区 |
  | `route_still_cross_zone` | A* 规划路径是否仍与限飞区相交（true = 避让失败警告） |
  | `crossed_zones` | 直线穿越的限飞区明细（id/name/level） |

#### 4.3.2 航线详情

- **URL**: `GET /api/route/{id}`

#### 4.3.3 根据订单 ID 查询航线

- **URL**: `GET /api/route/order/{orderId}`

#### 4.3.4 当前飞行中的航线列表

- **URL**: `GET /api/route/active`
- **说明**: 返回所有 `flying` 状态的航线（含 route_geom GeoJSON），前端用于地图实时渲染

### 4.4 限飞区

#### 4.4.1 限飞区列表（GeoJSON）

- **URL**: `GET /api/no-fly-zone/list`
- **参数**: `level`（可选）- strict / warning
- **响应示例**:
```json
{
  "code": 200,
  "data": [
    {
      "id": 1,
      "name": "图书馆禁飞区",
      "source_table": "other_buildings",
      "source_id": 5,
      "geom": "{\"type\":\"MultiPolygon\",\"coordinates\":[...]}",
      "level": "strict",
      "reason": "人流密集区域",
      "create_time": "2026-09-08T10:00:00"
    }
  ]
}
```

#### 4.4.2 检测线段是否穿越限飞区

- **URL**: `POST /api/no-fly-zone/check`
- **参数**: `startLng`、`startLat`、`endLng`、`endLat`
- **响应**: 穿越的限飞区列表（id/name/level）

### 4.5 餐厅

#### 4.5.1 餐厅列表

- **URL**: `GET /api/restaurant/list`

#### 4.5.2 餐厅详情（含建筑坐标）

- **URL**: `GET /api/restaurant/{id}`
- **响应示例**:
```json
{
  "code": 200,
  "data": {
    "id": 1,
    "building_id": 12,
    "name": "一食堂",
    "window_count": 10,
    "open_time": "07:00-21:00",
    "rating": 4.5,
    "phone": "0311-88888888",
    "center_lng": 114.470404,
    "center_lat": 37.983182,
    "building_geojson": "{\"type\":\"Polygon\",\"coordinates\":[...]}"
  }
}
```

#### 4.5.3 餐厅的产品列表

- **URL**: `GET /api/restaurant/{id}/products`
- **参数**: `category`（可选）- 主食/小吃/饮品/套餐

### 4.6 商品

#### 4.6.1 商品列表

- **URL**: `GET /api/product/list`
- **参数**: `restaurantId`（可选）、`category`（可选）、`keyword`（可选）

#### 4.6.2 商品详情

- **URL**: `GET /api/product/{id}`

#### 4.6.3 热销商品榜

- **URL**: `GET /api/product/hot`
- **参数**: `limit`（默认10）
- **说明**: 按销量降序返回热销商品

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
