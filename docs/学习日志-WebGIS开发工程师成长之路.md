# WebGIS 开发工程师学习日志

> 基于「校园数字孪生 WebGIS MVP」项目实战，从小白到就业的完整学习路径
>
> 项目技术栈：Vue3 + Vite + Cesium + Spring Boot + MyBatis-Plus + PostgreSQL/PostGIS
>
> 使用方法：按阶段顺序学习，每阶段读完概念 → 看懂项目代码 → 独立完成练习题 → 对照自测清单，全部通过再进入下一阶段。

---

## 阶段 0：学前准备 — 你需要知道的事

### 学习目标
- 理解 WebGIS 是什么，和普通 Web 开发、普通 GIS 的区别
- 了解本项目的整体架构和学习路线
- 搭建好开发环境

### 核心概念

**什么是 WebGIS？**
WebGIS = Web + GIS，就是把地理信息系统（GIS）搬到浏览器里。你在浏览器里看到的高德地图、百度地图、滴滴打车的地图界面，都是 WebGIS。

**和普通 Web 开发的区别：**
| 维度 | 普通 Web 开发 | WebGIS 开发 |
|------|-------------|------------|
| 数据 | JSON 文本 | 空间数据（点/线/面 + 坐标） |
| 前端 | DOM 操作 | 三维地球引擎（Cesium）/ 二维地图（Leaflet/OpenLayers） |
| 后端 | CRUD | 空间查询（相交、缓冲区、距离计算） |
| 数据库 | MySQL | PostgreSQL + PostGIS（空间扩展） |

**本项目架构（5 层）：**
```
浏览器（Vue3 + Cesium 三维渲染）
    ↓ HTTP 请求
后端（Spring Boot + 空间查询接口 + MVT 瓦片接口）
    ↓ SQL（含空间函数）
数据库（PostgreSQL + PostGIS，存校园建筑/道路/场地矢量数据）
```

### 环境搭建清单

| 软件 | 版本要求 | 用途 | 验证命令 |
|------|---------|------|---------|
| JDK | 17+ | 后端运行 | `java -version` |
| Maven | 3.6+ | 后端依赖管理 | `mvn -version` |
| Node.js | 16+ | 前端运行 | `node -version` |
| PostgreSQL | 14+ | 数据库 | `psql --version` |
| PostGIS | 3.x | 空间扩展 | SQL: `SELECT PostGIS_version();` |
| IntelliJ IDEA | 最新 | 后端 IDE | — |
| VS Code / WebStorm | 最新 | 前端 IDE | — |

> 新手提示：IDEA 自带 JDK 和 Maven，不用单独装。PostgreSQL 安装时勾选 PostGIS 组件即可。

### 练习题 0

**题目**：在你的电脑上完成环境搭建，然后回答以下问题：
1. WebGIS 和普通 Web 开发最大的区别是什么？
2. PostGIS 是做什么的？为什么不用 MySQL？
3. 打开命令行，依次执行 `java -version`、`node -version`、`psql --version`，截图保存。

**参考答案**：
1. 数据维度不同：WebGIS 处理带坐标的空间数据，需要空间数据库和地图引擎。
2. PostGIS 是 PostgreSQL 的空间扩展，提供空间数据类型和空间函数（ST_Intersects 等），MySQL 的空间功能不完善。
3. （自行验证）

### 自测清单
- [ ] 能说清 WebGIS 的定义和应用场景
- [ ] JDK、Node、PostgreSQL 全部安装成功
- [ ] PostGIS 扩展已启用（`CREATE EXTENSION postgis;` 执行成功）

---

## 阶段 1：空间数据库基础 — PostGIS 入门

### 学习目标
- 理解空间数据模型（点、线、面）
- 掌握 PostGIS 常用空间函数
- 学会导入 shp 数据到 PostGIS
- 能写基本的空间查询 SQL

### 核心概念

**空间数据三要素：**
- **点（Point）**：一个坐标，如设备点位、摄像头
- **线（LineString）**：一串坐标连成的线，如道路、河流
- **面（Polygon）**：闭合的坐标围成的区域，如建筑、操场、校园边界

**SRID（空间参考标识符）：**
- 坐标必须有坐标系才有意义
- `4326` = WGS84 经纬度（GPS 用的坐标系，本项目用的就是它）
- `3857` = Web Mercator（Web 地图常用的投影坐标系，用于计算距离/面积）

**常用空间函数（ST 前缀 = Spatial Type）：**

| 函数 | 作用 | 本项目用法 |
|------|------|-----------|
| `ST_AsGeoJSON(geom)` | 把几何转成 GeoJSON 字符串 | 前端加载数据时必用 |
| `ST_Intersects(a, b)` | 判断两个几何是否相交 | 点击建筑时判断点在哪个建筑内 |
| `ST_DWithin(a, b, r)` | 判断 a 距离 b 是否在 r 范围内 | 缓冲区查询（周边要素） |
| `ST_Distance(a, b)` | 计算两个几何的距离 | 缓冲区查询结果按距离排序 |
| `ST_Area(geom)` | 计算面积 | 统计建筑面积 |
| `ST_Length(geom)` | 计算长度 | 统计道路总长 |
| `ST_Centroid(geom)` | 求几何中心点 | 弹窗定位 |
| `ST_Transform(geom, srid)` | 转换坐标系 | 4326 转 3857 计算米制距离 |
| `ST_SetSRID(geom, srid)` | 给几何设置坐标系 | 构造点时指定 4326 |
| `ST_MakePoint(lng, lat)` | 构造一个点 | 点击坐标转 PostGIS 点 |
| `ST_AsMVT(...)` | 生成矢量瓦片 | MVT 瓦片接口 |

> 新手提示：函数名里的 `ST` 不是"石头"的意思，是 OGC 标准里的"Spatial Type"缩写。

**shp 导入 PostGIS 的方法：**
1. 用 PostGIS 自带的 `shp2pgsql-gui` 工具（图形界面）
2. 选择 shp 文件 → 设置目标数据库 → 导入
3. 导入后表名默认和 shp 文件名一致，字段包含 `geom`、`name`、`SHAPE_Leng`、`SHAPE_Area` 等

### 项目代码示例

本项目的 `school` 表查询（获取校园边界和中心点）：

```sql
SELECT
    ST_XMin(ST_Extent(geom)) AS minx,        -- 最小经度
    ST_YMin(ST_Extent(geom)) AS miny,        -- 最小纬度
    ST_XMax(ST_Extent(geom)) AS maxx,        -- 最大经度
    ST_YMax(ST_Extent(geom)) AS maxy,        -- 最大纬度
    ST_X(ST_Centroid(ST_Extent(geom))) AS center_lng,  -- 中心经度
    ST_Y(ST_Centroid(ST_Extent(geom))) AS center_lat,  -- 中心纬度
    ST_Area(ST_Transform(ST_SetSRID(ST_Extent(geom), 4326), 3857)) AS area_sqm
FROM school
```

点选查询（点击坐标，查落在哪个建筑里）：

```sql
SELECT id, name, height, ST_AsGeoJSON(geom) AS geom
FROM teaching_building
WHERE ST_Intersects(
    geom,
    ST_SetSRID(ST_MakePoint(114.465, 38.04), 4326)
)
```

### 练习题 1

**题目 1（基础）**：写一条 SQL，查询 `dormitory`（宿舍楼）表中所有宿舍楼的名称和楼层数，按楼层数从高到低排序。

**题目 2（进阶）**：写一条 SQL，查询坐标点 `(114.465, 38.04)` 周围 200 米内的所有教学楼，按距离升序排列，返回名称和距离（米）。

**题目 3（挑战）**：写一条 SQL，统计所有建筑（teaching_building + dormitory + other_buildings）的总数量和总占地面积（平方米）。

**参考答案**：

```sql
-- 题目 1
SELECT name, height FROM dormitory ORDER BY height DESC;

-- 题目 2
SELECT
    name,
    ROUND(
        ST_Distance(
            ST_Transform(ST_SetSRID(geom, 4326), 3857),
            ST_Transform(ST_SetSRID(ST_MakePoint(114.465, 38.04), 4326), 3857)
        )::numeric, 2
    ) AS distance_m
FROM teaching_building
WHERE ST_DWithin(
    ST_Transform(ST_SetSRID(geom, 4326), 3857),
    ST_Transform(ST_SetSRID(ST_MakePoint(114.465, 38.04), 4326), 3857),
    200
)
ORDER BY distance_m ASC;

-- 题目 3
SELECT
    COUNT(*) AS total_count,
    ROUND(SUM(ST_Area(ST_Transform(ST_SetSRID(geom, 4326), 3857)))::numeric, 2) AS total_area_sqm
FROM (
    SELECT geom FROM teaching_building
    UNION ALL
    SELECT geom FROM dormitory
    UNION ALL
    SELECT geom FROM other_buildings
) AS all_buildings;
```

### 自测清单
- [ ] 能说清点、线、面三种空间数据的区别并举例
- [ ] 知道 4326 和 3857 的区别，什么情况下需要转换
- [ ] 能独立写出 ST_Intersects 点选查询
- [ ] 能独立写出 ST_DWithin 缓冲区查询
- [ ] 理解为什么计算距离/面积时要 ST_Transform 到 3857

---

## 阶段 2：后端基础 — Spring Boot 入门

### 学习目标
- 理解 Spring Boot 是什么，为什么 WebGIS 后端用它
- 掌握 Spring Boot 项目结构和启动方式
- 学会写 REST API 接口
- 理解统一响应格式和全局异常处理

### 核心概念

**什么是 Spring Boot？**
Spring Boot 是 Java 后端框架，特点是"约定优于配置"——不用写一堆 XML 配置，一个主类加 `@SpringBootApplication` 注解就能启动。内置 Tomcat 服务器，打包成 jar 直接 `java -jar` 运行。

**项目结构（MVC 三层架构）：**
```
com.campus.twin/
├── CampusTwinApplication.java    ← 启动类（main 方法在这里）
├── controller/                    ← 控制层：接收 HTTP 请求，调用 Service
├── service/                       ← 业务层：写业务逻辑
│   └── impl/                      ← 业务实现类
├── mapper/                        ← 数据访问层：写 SQL，操作数据库
├── entity/                        ← 实体类：和数据库表一一对应
├── dto/                           ← 数据传输对象：接口返回的自定义结构
├── common/                        ← 公共类：统一响应、异常处理
└── config/                        ← 配置类：跨域、Swagger、MyBatis 配置
```

**请求流转过程：**
```
浏览器发请求
    → Controller（@RestController，定义 URL 路径）
        → Service（接口 + 实现类，写业务逻辑）
            → Mapper（MyBatis，执行 SQL）
                → PostgreSQL（返回数据）
            ← Mapper 返回数据
        ← Service 处理后返回
    ← Controller 封装成统一响应返回
浏览器收到 JSON
```

**统一响应格式：**
```json
{
  "code": 200,
  "message": "success",
  "data": { ... }
}
```
- `code`：状态码，200 成功，400 参数错误，500 服务器错误
- `message`：提示信息
- `data`：实际数据

**常用注解：**
| 注解 | 作用 | 位置 |
|------|------|------|
| `@SpringBootApplication` | 标记启动类 | 主类上 |
| `@RestController` | 标记控制层，返回 JSON | Controller 类上 |
| `@RequestMapping("/api")` | 定义 URL 前缀 | Controller 类上 |
| `@GetMapping("/xxx")` | GET 请求路径 | 方法上 |
| `@RequestParam` | 接收 URL 参数 | 方法参数上 |
| `@PathVariable` | 接收路径参数 | 方法参数上 |
| `@Service` | 标记业务层 | Service 实现类上 |
| `@Mapper` | 标记数据访问层 | Mapper 接口上 |
| `@Autowired` / `@RequiredArgsConstructor` | 依赖注入 | 类上/字段上 |

### 项目代码示例

启动类：
```java
@SpringBootApplication
@MapperScan("com.campus.twin.mapper")  // 扫描 Mapper 接口
public class CampusTwinApplication {
    public static void main(String[] args) {
        SpringApplication.run(CampusTwinApplication.class, args);
    }
}
```

一个最简单的 Controller：
```java
@RestController
@RequestMapping("/api/stat")
@RequiredArgsConstructor  // Lombok 注解，自动生成构造函数注入
public class StatController {

    private final StatService statService;  // 依赖注入

    @GetMapping("/overview")
    public Result<CampusOverview> getOverview() {
        return Result.success(statService.getOverview());
    }
}
```

### 练习题 2

**题目 1（基础）**：在项目中新增一个接口 `GET /api/hello`，返回 `{"code":200, "message":"success", "data":"Hello WebGIS"}`。需要新建一个 `HelloController` 类。

**题目 2（进阶）**：新增一个接口 `GET /api/spatial/building-count`，接收参数 `table`（表名），返回该表的记录数。需要写 Controller → Service → Mapper 完整链路。

**题目 3（挑战）**：实现全局异常处理，当接口抛出 `IllegalArgumentException` 时，返回 `{"code":400, "message": 异常信息}`。提示：用 `@RestControllerAdvice` + `@ExceptionHandler`。

**参考答案**：

```java
// 题目 1
@RestController
@RequestMapping("/api")
public class HelloController {
    @GetMapping("/hello")
    public Result<String> hello() {
        return Result.success("Hello WebGIS");
    }
}
```

```java
// 题目 2 - Controller
@RestController
@RequestMapping("/api/spatial")
@RequiredArgsConstructor
public class SpatialController {
    private final SpatialService spatialService;

    @GetMapping("/building-count")
    public Result<Integer> getBuildingCount(@RequestParam String table) {
        return Result.success(spatialService.getCount(table));
    }
}

// Service 接口
public interface SpatialService {
    Integer getCount(String table);
}

// Service 实现
@Service
@RequiredArgsConstructor
public class SpatialServiceImpl implements SpatialService {
    private final SpatialQueryMapper spatialQueryMapper;

    @Override
    public Integer getCount(String table) {
        return spatialQueryMapper.selectCount(table);
    }
}

// Mapper
@Mapper
public interface SpatialQueryMapper {
    Integer selectCount(@Param("table") String table);
}
```

```xml
<!-- Mapper XML -->
<select id="selectCount" resultType="java.lang.Integer">
    SELECT COUNT(*) FROM ${table}
</select>
```

```java
// 题目 3
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(IllegalArgumentException.class)
    public Result<Void> handleIllegalArgument(IllegalArgumentException e) {
        return Result.error(400, e.getMessage());
    }
}
```

### 自测清单
- [ ] 能说清 Controller → Service → Mapper 三层的调用关系
- [ ] 能独立写一个 GET 接口，包含 Controller、Service、Mapper
- [ ] 理解 `@RequestParam` 和 `@PathVariable` 的区别
- [ ] 理解统一响应格式的作用
- [ ] 知道 `@RestControllerAdvice` 是做什么的

---

## 阶段 3：MyBatis-Plus 与动态 SQL — 数据访问层

### 学习目标
- 理解 MyBatis 和 MyBatis-Plus 的区别
- 掌握实体类与表的映射
- 学会写动态 SQL（`<if>` 标签）
- 理解动态表名的用法和安全风险

### 核心概念

**MyBatis vs MyBatis-Plus：**
- **MyBatis**：半自动 ORM，SQL 自己写在 XML 里，灵活但繁琐
- **MyBatis-Plus**：在 MyBatis 基础上增强，提供通用 CRUD 方法（`selectById`、`insert`、`updateById` 等），不用写基础 SQL，复杂查询还是写 XML

**实体类映射：**
```java
@Data                           // Lombok：自动生成 getter/setter/toString
@TableName("teaching_building") // 对应数据库表名
public class TeachingBuilding {
    @TableId(type = IdType.AUTO) // 主键，自增
    private Integer id;

    private String name;          // 自动映射 name 列

    private Integer height;       // 自动映射 height 列

    @TableField("SHAPE_Leng")    // 列名和字段名不一致时显式指定
    private Double shapeLeng;

    private String geom;          // 空间字段，用 String 接收 GeoJSON
}
```

**为什么 geom 用 String 而不是几何对象？**
PostGIS 的 geometry 类型在 Java 里没有直接对应的简单类型。最简单的做法是查询时用 `ST_AsGeoJSON(geom)` 转成 JSON 字符串，Java 用 `String` 接收，前端拿到后 `JSON.parse()` 就能用。

**动态 SQL（`<if>` 标签）：**
本项目的关键技巧——不同表的字段不一样（school 没有 name，road 没有 SHAPE_Area），用 `<if>` 按表名动态拼接 SQL：

```xml
<select id="selectAllGeoJson" resultType="java.util.Map">
    SELECT
        id,
        <if test='table != "school"'>name,</if>
        <if test='table == "teaching_building" or table == "dormitory" or table == "other_buildings"'>height,</if>
        "SHAPE_Leng" AS shape_leng,
        <if test='table != "road"'>"SHAPE_Area" AS shape_area,</if>
        ST_AsGeoJSON(geom) AS geom
    FROM ${table}
    ORDER BY id ASC
</select>
```

**`#{}` vs `${}` 的区别（重要！）：**
| 语法 | 作用 | 安全性 | 本项目用法 |
|------|------|--------|-----------|
| `#{lng}` | 预编译参数，自动加引号 | 防 SQL 注入 | 传坐标值、ID 值 |
| `${table}` | 字符串直接替换 | 有注入风险 | 动态表名/列名 |

**为什么动态表名要用 `${}`？**
SQL 里表名不能用预编译参数（`?` 只能代替值，不能代替表名/列名），所以只能用 `${}` 直接拼接。但这样有 SQL 注入风险，所以必须加**表名白名单校验**：

```java
private static final Set<String> ALLOWED_TABLES = Set.of(
    "school", "teaching_building", "dormitory", "other_buildings",
    "road", "playground", "basketball_court", "tennis_court"
);

public void validateTable(String table) {
    if (!ALLOWED_TABLES.contains(table)) {
        throw new IllegalArgumentException("非法表名: " + table);
    }
}
```

### 项目代码示例

继承体系设计（应对字段差异）：
```
BaseSpatialEntity（id, name, geom, shapeLeng）
    └── BaseAreaEntity（增加 shapeArea）← 所有面要素继承这个
            ├── School
            ├── TeachingBuilding
            ├── Dormitory
            ├── OtherBuilding
            ├── Playground
            ├── BasketballCourt
            └── TennisCourt
    └── Road（直接继承 BaseSpatialEntity，没有 shapeArea）
```

### 练习题 3

**题目 1（基础）**：为 `road` 表写一个实体类 `Road`，要求：
- 表名 `road`
- 字段：id, name, geom, shapeLeng
- 注意：road 表没有 SHAPE_Area 字段

**题目 2（进阶）**：写一个动态 SQL，根据传入的 `table` 参数查询所有要素。如果 `table` 是 `road`，不查询 `SHAPE_Area`；如果是其他表，查询 `SHAPE_Area`。所有表都要查询 `id, name, geom`。

**题目 3（挑战）**：实现一个通用的点选查询 Mapper 方法 `selectByPoint(table, lng, lat)`，要求：
- 用 `${table}` 动态表名
- 用 `#{lng}`、`#{lat}` 预编译参数
- 用 `ST_Intersects` 判断点是否在要素内
- 返回匹配的第一个要素

**参考答案**：

```java
// 题目 1
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("road")
public class Road extends BaseSpatialEntity {
    // 继承了 id, name, geom, shapeLeng
    // 没有 shapeArea，所以不继承 BaseAreaEntity
}
```

```xml
<!-- 题目 2 -->
<select id="selectAll" resultType="java.util.Map">
    SELECT
        id,
        name,
        ST_AsGeoJSON(geom) AS geom,
        <if test='table != "road"'>"SHAPE_Area" AS shape_area,</if>
        "SHAPE_Leng" AS shape_leng
    FROM ${table}
</select>
```

```xml
<!-- 题目 3 -->
<select id="selectByPoint" resultType="java.util.Map">
    SELECT
        id,
        name,
        height,
        ST_AsGeoJSON(geom) AS geom
    FROM ${table}
    WHERE ST_Intersects(
        geom,
        ST_SetSRID(ST_MakePoint(#{lng}, #{lat}), 4326)
    )
    LIMIT 1
</select>
```

### 自测清单
- [ ] 能说清 MyBatis 和 MyBatis-Plus 的区别
- [ ] 能写实体类，知道 `@TableName`、`@TableId`、`@TableField` 的用法
- [ ] 理解为什么 geom 字段用 String 接收
- [ ] 能写 `<if>` 动态 SQL
- [ ] 深刻理解 `#{}` 和 `${}` 的区别，知道什么时候必须用白名单校验

---

## 阶段 4：空间查询接口实战 — 后端核心能力

### 学习目标
- 掌握点选查询、缓冲区查询的实现
- 理解 MVT 矢量瓦片的原理和实现
- 学会设计 RESTful 空间查询 API
- 理解模拟数据的设计思路

### 核心概念

**点选查询（Point Query）：**
用户在地图上点击一个坐标，后端查询这个点落在哪个要素（建筑/道路/场地）内。这是 WebGIS 最基础的交互。

核心 SQL：`ST_Intersects(geom, ST_SetSRID(ST_MakePoint(lng, lat), 4326))`

**缓冲区查询（Buffer Query）：**
给定一个中心点和半径，查询范围内的所有要素，按距离排序。常用于"周边有什么"。

核心 SQL：`ST_DWithin(geom, point, radius)` + `ST_Distance(geom, point)` 排序

**MVT 矢量瓦片（Mapbox Vector Tile）：**
- 什么是瓦片？把地图切成一格一格的小图片，前端按需加载，避免一次加载全部数据
- 矢量瓦片 vs 栅格瓦片：栅格瓦片是图片（png/jpg），矢量瓦片是数据（protobuf 格式），前端拿到后自己渲染，可以调整样式、可以点击
- PostGIS 原生支持：`ST_AsMVT()` 直接生成 MVT 格式，不需要额外的瓦片服务器

**MVT 生成 SQL（核心中的核心）：**
```sql
WITH bounds AS (
    SELECT ST_TileEnvelope(z, x, y) AS geom  -- 计算当前瓦片的边界
),
mvtgeom AS (
    SELECT
        id, name, height,
        ST_AsMVTGeom(              -- 把几何转到瓦片坐标空间
            ST_Transform(ST_SetSRID(t.geom, 4326), 3857),
            (SELECT geom FROM bounds),
            4096, 64, true
        ) AS geom
    FROM ${table} t
    WHERE ST_Intersects(          -- 只查和当前瓦片相交的要素
        ST_Transform(ST_SetSRID(t.geom, 4326), 3857),
        (SELECT geom FROM bounds)
    )
)
SELECT ST_AsMVT(mvtgeom.*, '${table}', 4096, 'geom')  -- 打包成 MVT
FROM mvtgeom
WHERE geom IS NOT NULL
```

**模拟物联网数据：**
MVP 阶段没有真实传感器，用 Java 代码在内存里随机生成设备点位。关键点：
- 设备坐标基于校园边界随机生成（在校园范围内）
- 设备类型：摄像头、路灯、烟感、能耗传感器
- 在线/离线状态随机（90% 在线）
- 用 `@PostConstruct` 在服务启动时初始化一次，存在内存里

### 项目代码示例

缓冲区查询 Service：
```java
@Override
public List<Map<String, Object>> bufferQuery(String table, Double lng, Double lat, Double radius) {
    validateTable(table);  // 白名单校验
    return spatialQueryMapper.selectByBuffer(table, lng, lat, radius);
}
```

MVT 瓦片 Controller（返回二进制，不是 JSON）：
```java
@GetMapping(value = "/{table}/{z}/{x}/{y}.mvt", produces = "application/x-protobuf")
public void getMvtTile(@PathVariable String table, @PathVariable Integer z,
                       @PathVariable Integer x, @PathVariable Integer y,
                       HttpServletResponse response) throws IOException {
    byte[] mvtData = tileService.getMvtTile(table, z, x, y);
    response.setContentType("application/x-protobuf");
    response.setContentLength(mvtData.length);
    response.setHeader("Cache-Control", "public, max-age=3600");
    try (OutputStream out = response.getOutputStream()) {
        out.write(mvtData);
        out.flush();
    }
}
```

### 练习题 4

**题目 1（基础）**：实现一个接口 `GET /api/spatial/nearby-buildings`，参数：`lng, lat, radius`，返回该点周围指定半径内的所有建筑（三张建筑表合并查询），按距离升序。

**题目 2（进阶）**：实现 MVT 瓦片接口的 Service 层，要求：
- 校验表名白名单
- 校验 z/x/y 参数范围（z: 0-22, x/y >= 0）
- 调用 Mapper 获取瓦片二进制数据
- 异常时返回空字节数组，不抛出异常

**题目 3（挑战）**：设计一个模拟设备数据生成器，要求：
- 在 `@PostConstruct` 中初始化
- 生成 20 个路灯设备，坐标在给定经纬度范围内随机
- 每个设备有 id、name、lng、lat、online（85% 在线）
- 提供 `getDevices()` 方法返回全部设备

**参考答案**：

```java
// 题目 1 - Mapper XML
<select id="selectNearbyBuildings" resultType="java.util.Map">
    SELECT
        id, name, height,
        'teaching_building' AS table_name,
        ST_AsGeoJSON(geom) AS geom,
        ROUND(ST_Distance(
            ST_Transform(ST_SetSRID(geom, 4326), 3857),
            ST_Transform(ST_SetSRID(ST_MakePoint(#{lng}, #{lat}), 4326), 3857)
        )::numeric, 2) AS distance_m
    FROM teaching_building
    WHERE ST_DWithin(
        ST_Transform(ST_SetSRID(geom, 4326), 3857),
        ST_Transform(ST_SetSRID(ST_MakePoint(#{lng}, #{lat}), 4326), 3857),
        #{radius}
    )
    UNION ALL
    -- 同样的结构查 dormitory 和 other_buildings
    SELECT id, name, height, 'dormitory' AS table_name,
           ST_AsGeoJSON(geom) AS geom,
           ROUND(ST_Distance(...)::numeric, 2) AS distance_m
    FROM dormitory WHERE ST_DWithin(...)
    UNION ALL
    SELECT id, name, height, 'other_buildings' AS table_name,
           ST_AsGeoJSON(geom) AS geom,
           ROUND(ST_Distance(...)::numeric, 2) AS distance_m
    FROM other_buildings WHERE ST_DWithin(...)
    ORDER BY distance_m ASC
</select>
```

```java
// 题目 2
@Service
@RequiredArgsConstructor
public class TileServiceImpl implements TileService {
    private final TileMapper tileMapper;
    private final SpatialService spatialService;

    @Override
    public byte[] getMvtTile(String table, Integer z, Integer x, Integer y) {
        spatialService.validateTable(table);
        if (z < 0 || z > 22 || x < 0 || y < 0) {
            return new byte[0];
        }
        try {
            byte[] mvt = tileMapper.selectMvt(table, z, x, y);
            return mvt != null ? mvt : new byte[0];
        } catch (Exception e) {
            return new byte[0];
        }
    }
}
```

```java
// 题目 3
@Service
public class MockDeviceService {
    private List<DeviceInfo> devices = new ArrayList<>();
    private final Random random = new Random(42);  // 固定种子，每次启动结果一样

    @PostConstruct
    public void init() {
        double minLng = 114.45, maxLng = 114.48;
        double minLat = 38.03, maxLat = 38.05;
        for (int i = 1; i <= 20; i++) {
            devices.add(DeviceInfo.builder()
                .id("streetlight-" + String.format("%03d", i))
                .name("路灯-" + i + "号")
                .type("streetlight")
                .typeLabel("路灯")
                .lng(minLng + random.nextDouble() * (maxLng - minLng))
                .lat(minLat + random.nextDouble() * (maxLat - minLat))
                .online(random.nextDouble() > 0.15)  // 85% 在线
                .build());
        }
    }

    public List<DeviceInfo> getDevices() {
        return devices;
    }
}
```

### 自测清单
- [ ] 能说清点选查询的实现思路和核心 SQL
- [ ] 能说清缓冲区查询的实现思路和核心 SQL
- [ ] 理解 MVT 矢量瓦片的原理，能说清 ST_TileEnvelope、ST_AsMVTGeom、ST_AsMVT 三个函数的作用
- [ ] 知道 MVT 接口返回的是二进制（application/x-protobuf），不是 JSON
- [ ] 能设计模拟数据，知道 @PostConstruct 的用法
- [ ] 理解为什么固定随机种子（new Random(42)）

---

## 阶段 5：前端基础 — Vue3 + Vite 入门

### 学习目标
- 理解 Vue3 组合式 API（Composition API）
- 掌握 Vite 项目结构和启动方式
- 学会用 Element-Plus 做 UI
- 理解 Pinia 状态管理

### 核心概念

**Vue3 组合式 API（`<script setup>`）：**
Vue3 推荐用 `<script setup>` 语法，代码更简洁：

```vue
<script setup>
import { ref, computed, onMounted } from 'vue'

// 响应式变量
const count = ref(0)

// 计算属性
const doubleCount = computed(() => count.value * 2)

// 方法
function increment() {
    count.value++  // ref 变量要 .value 访问
}

// 生命周期
onMounted(() => {
    console.log('组件挂载完成')
})
</script>

<template>
    <button @click="increment">计数: {{ count }}</button>
    <p>双倍: {{ doubleCount }}</p>
</template>
```

**ref vs reactive：**
| | ref | reactive |
|--|-----|----------|
| 适用 | 基本类型（数字、字符串） | 对象类型 |
| 访问 | 需要 `.value` | 直接访问属性 |
| 推荐 | 优先用 ref | 复杂对象用 |

**Vite 是什么？**
新一代前端构建工具，开发时用原生 ES Module，启动极快（毫秒级），热更新（HMR）即时生效。`npm run dev` 启动开发服务器，`npm run build` 打包生产版本。

**Vite 代理（解决跨域）：**
前端开发服务器在 5173，后端在 8080，浏览器直接请求 8080 会跨域。Vite 配置代理，把 `/api` 和 `/tiles` 开头的请求转发到 8080：

```js
// vite.config.js
server: {
    port: 5173,
    proxy: {
        '/api': { target: 'http://localhost:8080', changeOrigin: true },
        '/tiles': { target: 'http://localhost:8080', changeOrigin: true }
    }
}
```

**Element-Plus：**
Vue3 的 UI 组件库，提供按钮、表单、弹窗、标签等现成组件。用的时候直接在模板里写 `<el-button>`、`<el-tag>` 等。

**Pinia 状态管理：**
当多个组件需要共享数据时（比如当前选中的建筑、图层显隐状态），用 Pinia 统一管理。定义一个 store，所有组件都能读写。

```javascript
// stores/map.js
import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'

export const useMapStore = defineStore('map', () => {
    // state
    const selectedBuilding = ref(null)
    const layers = reactive({ teaching: true, dormitory: true })

    // actions
    function selectBuilding(building) {
        selectedBuilding.value = building
    }
    function setLayerVisible(name, visible) {
        layers[name] = visible
    }

    return { selectedBuilding, layers, selectBuilding, setLayerVisible }
})
```

组件里使用：
```javascript
import { useMapStore } from '@/stores/map'
import { storeToRefs } from 'pinia'  // 注意：从 pinia 导入，不是 vue！

const mapStore = useMapStore()
const { selectedBuilding, layers } = storeToRefs(mapStore)  // 解构保持响应式
```

> 新手坑：`storeToRefs` 是 `pinia` 的导出，不是 `vue` 的！从 vue 导入会报 `does not provide an export named 'storeToRefs'`。

### 项目代码示例

Axios 封装（统一处理响应）：
```javascript
// api/request.js
import axios from 'axios'

const request = axios.create({ baseURL: '/', timeout: 30000 })

// 响应拦截器：统一处理 {code, message, data}
request.interceptors.response.use(
    response => {
        const res = response.data
        if (res.code === 200) return res.data  // 直接返回 data
        else return Promise.reject(new Error(res.message))
    },
    error => Promise.reject(error)
)

export default request
```

### 练习题 5

**题目 1（基础）**：创建一个 Vue 组件 `Counter.vue`，包含一个数字和两个按钮（+1、-1），数字变化时页面实时更新。使用 `<script setup>` 和 `ref`。

**题目 2（进阶）**：创建一个 Pinia store `useUserStore`，管理用户信息（name、age），提供 `setName`、`setAge`、`reset` 三个方法。然后在两个组件中分别使用这个 store，验证数据共享。

**题目 3（挑战）**：封装一个 API 模块 `api/user.js`，包含：
- `getUser(id)` — GET 请求 `/api/user/{id}`
- `updateUser(id, data)` — PUT 请求 `/api/user/{id}`
- 要求使用封装好的 `request` 实例，统一处理响应格式

**参考答案**：

```vue
<!-- 题目 1 -->
<script setup>
import { ref } from 'vue'
const count = ref(0)
function increment() { count.value++ }
function decrement() { count.value-- }
</script>
<template>
    <div>
        <p>当前数字: {{ count }}</p>
        <button @click="increment">+1</button>
        <button @click="decrement">-1</button>
    </div>
</template>
```

```javascript
// 题目 2 - stores/user.js
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
    const name = ref('')
    const age = ref(0)

    function setName(newName) { name.value = newName }
    function setAge(newAge) { age.value = newAge }
    function reset() { name.value = ''; age.value = 0 }

    return { name, age, setName, setAge, reset }
})
```

```javascript
// 题目 3 - api/user.js
import request from './request'

export const getUser = (id) => request.get(`/api/user/${id}`)
export const updateUser = (id, data) => request.put(`/api/user/${id}`, data)
```

### 自测清单
- [ ] 能写 `<script setup>` 组件，知道 ref 需要 `.value`
- [ ] 理解 computed 和 watch 的区别
- [ ] 知道 Vite 代理是解决什么问题的
- [ ] 能定义一个 Pinia store，知道 `storeToRefs` 从 pinia 导入
- [ ] 能封装 Axios 请求，理解响应拦截器的作用

---

## 阶段 6：Cesium 三维可视化入门 — 前端核心能力

### 学习目标
- 理解 Cesium 是什么，能做什么
- 掌握 Viewer 初始化和基本配置
- 学会加载 GeoJSON 数据并渲染
- 掌握建筑白模拉伸（extrudedHeight）
- 理解相机控制（飞行、定位）

### 核心概念

**Cesium 是什么？**
CesiumJS 是一个开源的 JavaScript 三维地球引擎，在浏览器里渲染三维地球、建筑、地形、模型等。和 Three.js 的区别：Cesium 专门做地理空间（GIS），内置坐标系、投影、瓦片加载等 GIS 能力；Three.js 是通用 3D 引擎，不自带 GIS 能力。

**Viewer 初始化：**
```javascript
import * as Cesium from 'cesium'

const viewer = new Cesium.Viewer(container, {
    animation: false,           // 隐藏动画控件
    timeline: false,            // 隐藏时间轴
    baseLayerPicker: false,     // 隐藏底图选择器
    geocoder: false,            // 隐藏搜索框
    homeButton: true,           // 显示主页按钮
    sceneModePicker: false,     // 隐藏 2D/3D 切换
    navigationHelpButton: false, // 隐藏帮助按钮
    fullscreenButton: true,     // 显示全屏按钮
    infoBox: false,             // 禁用默认信息框（用自定义弹窗）
    selectionIndicator: false   // 禁用默认选中指示器
})
```

**底图加载：**
Cesium 默认用 Cesium Ion 在线底图（需要 token），国内访问慢。本项目用高德影像底图：

```javascript
viewer.imageryLayers.removeAll()  // 先移除默认底图
viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
        url: 'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
        subdomains: ['1', '2', '3', '4'],
        maximumLevel: 18
    })
)
```

**GeoJSON 加载：**
后端返回的要素列表里 `geom` 是 GeoJSON 字符串，先转成标准 GeoJSON FeatureCollection，再用 `GeoJsonDataSource.load()` 加载：

```javascript
// 转成标准 GeoJSON
const geoJson = {
    type: 'FeatureCollection',
    features: features.map(f => ({
        type: 'Feature',
        geometry: JSON.parse(f.geom),  // 字符串转对象
        properties: { ...f, geom: undefined }
    }))
}

// 加载到 Cesium
const dataSource = await Cesium.GeoJsonDataSource.load(geoJson, {
    stroke: Cesium.Color.WHITE.withAlpha(0.3),
    strokeWidth: 1,
    fill: Cesium.Color.fromCssColorString('#4A90D9').withAlpha(0.85),
    clampToGround: true
})
viewer.dataSources.add(dataSource)
```

**建筑白模拉伸（核心！）：**
加载 GeoJSON 后，遍历每个实体，设置 `polygon.extrudedHeight` 把平面拉成三维：

```javascript
const entities = dataSource.entities.values
for (const entity of entities) {
    const height = entity.properties?.height?.getValue() || 3
    entity.polygon.extrudedHeight = height * 3.5  // 每层 3.5 米
    entity.polygon.height = 0
    entity.polygon.outline = true
    entity.polygon.outlineColor = Cesium.Color.WHITE.withAlpha(0.4)
}
```

**相机控制：**
```javascript
// 立即定位
viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(lng, lat, height),
    orientation: {
        heading: Cesium.Math.toRadians(0),    // 方向角
        pitch: Cesium.Math.toRadians(-45),     // 俯仰角（-45 度俯视）
        roll: 0
    }
})

// 飞行到目标（有动画）
viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lng, lat, 600),
    duration: 2  // 飞行 2 秒
})
```

**Entity（实体）vs DataSource（数据源）：**
- **Entity**：Cesium 里的单个空间对象（一个点、一条线、一个面）
- **DataSource**：一组 Entity 的集合，GeoJSON 加载后就是一个 DataSource，里面包含多个 Entity
- `viewer.entities`：全局实体集合
- `viewer.dataSources`：数据源集合，每个 DataSource 有自己的 entities

### 项目代码示例

按建筑类型着色：
```javascript
const BUILDING_COLORS = {
    teaching: Cesium.Color.fromCssColorString('#4A90D9').withAlpha(0.85),  // 教学楼-蓝
    dormitory: Cesium.Color.fromCssColorString('#E8943A').withAlpha(0.85), // 宿舍楼-橙
    other: Cesium.Color.fromCssColorString('#5CB85C').withAlpha(0.85)      // 其他-绿
}
```

### 练习题 6

**题目 1（基础）**：写一个 Cesium Viewer 初始化函数，要求：
- 隐藏动画控件、时间轴、底图选择器、搜索框
- 移除默认底图，添加一个 OpenStreetMap 底图（URL: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`）
- 相机定位到北京（116.40, 39.90），高度 1000 米，俯视 45 度

**题目 2（进阶）**：给定以下 GeoJSON 数据，写代码加载到 Cesium 并拉伸为白模：
```json
{
  "type": "FeatureCollection",
  "features": [
    {"type": "Feature", "properties": {"name": "A栋", "height": 6}, "geometry": {"type": "Polygon", "coordinates": [[[116.40,39.90],[116.41,39.90],[116.41,39.91],[116.40,39.91],[116.40,39.90]]]}},
    {"type": "Feature", "properties": {"name": "B栋", "height": 8}, "geometry": {"type": "Polygon", "coordinates": [[[116.42,39.90],[116.43,39.90],[116.43,39.91],[116.42,39.91],[116.42,39.90]]]}}
  ]
}
```
要求：A栋红色，B栋蓝色，按 height × 3 米拉伸。

**题目 3（挑战）**：实现一个函数 `flyToBuilding(viewer, lng, lat)`，飞行到指定建筑，飞行结束后在建筑位置添加一个红色的闪烁点标记（用 `CallbackProperty` 实现大小变化的闪烁效果）。

**参考答案**：

```javascript
// 题目 1
function initViewer(container) {
    const viewer = new Cesium.Viewer(container, {
        animation: false, timeline: false, baseLayerPicker: false,
        geocoder: false, homeButton: false, sceneModePicker: false,
        navigationHelpButton: false, fullscreenButton: false
    })
    viewer.imageryLayers.removeAll()
    viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
            url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            maximumLevel: 19
        })
    )
    viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(116.40, 39.90, 1000),
        orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-45),
            roll: 0
        }
    })
    return viewer
}
```

```javascript
// 题目 2
async function loadBuildings(viewer, geoJson) {
    const dataSource = await Cesium.GeoJsonDataSource.load(geoJson)
    const entities = dataSource.entities.values
    for (const entity of entities) {
        const name = entity.properties.name.getValue()
        const height = entity.properties.height.getValue()
        // 设置颜色
        if (name === 'A栋') {
            entity.polygon.material = Cesium.Color.RED.withAlpha(0.8)
        } else {
            entity.polygon.material = Cesium.Color.BLUE.withAlpha(0.8)
        }
        // 拉伸
        entity.polygon.extrudedHeight = height * 3
        entity.polygon.height = 0
    }
    viewer.dataSources.add(dataSource)
}
```

```javascript
// 题目 3
function flyToBuilding(viewer, lng, lat) {
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lng, lat, 200),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
        duration: 2,
        complete: () => {
            // 飞行结束后添加闪烁点
            let pulse = 0
            viewer.entities.add({
                position: Cesium.Cartesian3.fromDegrees(lng, lat),
                point: {
                    pixelSize: new Cesium.CallbackProperty(() => {
                        pulse = (pulse + 0.05) % (Math.PI * 2)
                        return 10 + Math.sin(pulse) * 5
                    }, false),
                    color: Cesium.Color.RED,
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2
                }
            })
        }
    })
}
```

### 自测清单
- [ ] 能说清 Cesium 和 Three.js 的区别
- [ ] 能独立初始化 Viewer，知道常用配置项的含义
- [ ] 能加载 GeoJSON 数据并设置颜色
- [ ] 能实现建筑白模拉伸（extrudedHeight）
- [ ] 能控制相机飞行和定位
- [ ] 理解 Entity 和 DataSource 的关系

---

## 阶段 7：前后端联调 — 数据加载与渲染

### 学习目标
- 掌握前端调用后端接口获取空间数据
- 学会把后端返回的数据转成 Cesium 可渲染的格式
- 理解异步加载和错误处理
- 掌握图层显隐控制

### 核心概念

**前后端数据流转：**
```
前端 CesiumViewer 组件挂载
    → onMounted 里调用 api/spatial.js 的 getGeoJson('teaching_building')
        → Axios 发 GET 请求 /api/spatial/geojson/teaching_building
            → Vite 代理转发到 http://localhost:8080
                → Spring Boot Controller 接收请求
                    → Service 调用 Mapper
                        → PostgreSQL 执行 SELECT ... ST_AsGeoJSON(geom)
                        ← 返回 List<Map>，geom 是 GeoJSON 字符串
                    ← Service 返回
                ← Controller 封装成 Result 返回
            ← Axios 响应拦截器取出 data
        ← 前端拿到要素数组
    → toGeoJsonFeatureCollection() 转成标准 GeoJSON
    → Cesium.GeoJsonDataSource.load() 加载
    → 遍历实体设置 extrudedHeight 拉伸
    → viewer.dataSources.add() 添加到场景
```

**异步加载（async/await）：**
接口请求是异步的，用 `async/await` 等待结果：

```javascript
onMounted(async () => {
    const viewer = mapStore.initViewer(cesiumContainer.value)

    // 等待数据加载完成
    const teachingData = await getGeoJson('teaching_building')
    if (teachingData?.length) {
        mapStore.dataSources.teaching = await loadBuildings(viewer, teachingData, 'teaching', '教学楼')
    }
})
```

**图层显隐控制：**
每个图层加载后保存 DataSource 引用，需要显隐时设置 `dataSource.show = true/false`：

```javascript
// Pinia store 里保存引用
const dataSources = reactive({})

// 加载时保存
dataSources.teaching = await loadBuildings(...)

// 控制显隐
function setLayerVisible(layerName, visible) {
    layers[layerName] = visible
    const ds = dataSources[layerName]
    if (ds) ds.show = visible
}
```

**错误处理：**
接口可能失败（后端没启动、网络错误），用 `try/catch` 包裹：

```javascript
try {
    const data = await getGeoJson('teaching_building')
    // 处理数据
} catch (e) {
    console.error('加载教学楼数据失败:', e)
    // 可以给用户提示，或者用空数据兜底
}
```

### 项目代码示例

批量加载所有空间数据：
```javascript
async function loadAllSpatialData(viewer) {
    try {
        // 校园边界
        const schoolData = await getGeoJson('school')
        if (schoolData?.length) {
            mapStore.dataSources.school = await loadSchoolBoundary(viewer, schoolData, '校园边界')
        }

        // 教学楼
        const teachingData = await getGeoJson('teaching_building')
        if (teachingData?.length) {
            mapStore.dataSources.teaching = await loadBuildings(viewer, teachingData, 'teaching', '教学楼')
        }

        // ... 其他图层类似
    } catch (e) {
        console.error('加载空间数据失败:', e)
    }
}
```

### 练习题 7

**题目 1（基础）**：写一个函数 `loadRoads(viewer)`，调用后端接口 `/api/spatial/geojson/road` 获取道路数据，加载到 Cesium，线颜色灰色，宽度 3。要求用 try/catch 处理错误。

**题目 2（进阶）**：实现图层控制功能：
- 定义一个 `layers` 响应式对象，包含 `road` 和 `building` 两个布尔值
- 提供 `toggleLayer(name)` 方法切换显隐
- 切换时同步设置对应 DataSource 的 `show` 属性
- 在模板里用两个 checkbox 绑定这两个状态

**题目 3（挑战）**：实现一个数据加载进度提示：
- 加载 8 个图层，每加载完一个更新进度
- 用 Element-Plus 的 `ElProgress` 组件显示进度条
- 全部加载完成后隐藏进度条
- 某个图层加载失败时不中断，继续加载下一个，最后提示哪些失败了

**参考答案**：

```javascript
// 题目 1
import { getGeoJson } from '@/api/spatial'

async function loadRoads(viewer) {
    try {
        const roadData = await getGeoJson('road')
        if (!roadData?.length) {
            console.warn('没有道路数据')
            return
        }
        const geoJson = {
            type: 'FeatureCollection',
            features: roadData.map(f => ({
                type: 'Feature',
                geometry: JSON.parse(f.geom),
                properties: { ...f, geom: undefined }
            }))
        }
        const dataSource = await Cesium.GeoJsonDataSource.load(geoJson, {
            stroke: Cesium.Color.fromCssColorString('#888888'),
            strokeWidth: 3,
            clampToGround: true
        })
        viewer.dataSources.add(dataSource)
        return dataSource
    } catch (e) {
        console.error('加载道路失败:', e)
        return null
    }
}
```

```javascript
// 题目 2 - Pinia store
import { defineStore } from 'pinia'
import { reactive } from 'vue'

export const useLayerStore = defineStore('layer', () => {
    const layers = reactive({ road: true, building: true })
    const dataSources = reactive({})

    function toggleLayer(name) {
        layers[name] = !layers[name]
        const ds = dataSources[name]
        if (ds) ds.show = layers[name]
    }

    return { layers, dataSources, toggleLayer }
})
```

```vue
<!-- 题目 2 - 模板 -->
<template>
    <div>
        <el-checkbox v-model="layers.road" @change="toggleLayer('road')">道路</el-checkbox>
        <el-checkbox v-model="layers.building" @change="toggleLayer('building')">建筑</el-checkbox>
    </div>
</template>
```

```javascript
// 题目 3
const loading = ref(false)
const progress = ref(0)
const failedLayers = ref([])

const layerConfigs = [
    { name: 'school', label: '校园边界', table: 'school' },
    { name: 'teaching', label: '教学楼', table: 'teaching_building' },
    // ... 其他图层
]

async function loadAllWithProgress() {
    loading.value = true
    progress.value = 0
    failedLayers.value = []

    for (let i = 0; i < layerConfigs.length; i++) {
        const config = layerConfigs[i]
        try {
            const data = await getGeoJson(config.table)
            // 加载到 Cesium...
        } catch (e) {
            failedLayers.value.push(config.label)
        }
        progress.value = Math.round(((i + 1) / layerConfigs.length) * 100)
    }

    if (failedLayers.value.length > 0) {
        ElMessage.warning(`以下图层加载失败: ${failedLayers.value.join(', ')}`)
    }
    loading.value = false
}
```

### 自测清单
- [ ] 能说清前后端数据流转的完整过程
- [ ] 能用 async/await 调用后端接口
- [ ] 能把后端返回的 geom 字符串转成 Cesium 可加载的 GeoJSON
- [ ] 能用 try/catch 处理接口错误
- [ ] 能实现图层显隐控制，理解 DataSource.show 的作用

---

## 阶段 8：交互功能实战 — 点击、测量、弹窗

### 学习目标
- 掌握 Cesium 鼠标事件（点击、移动）
- 学会场景拾取（scene.pick）
- 实现建筑点击弹窗
- 实现测距、测面积工具
- 理解弹窗跟随地球旋转的实现

### 核心概念

**鼠标事件（ScreenSpaceEventHandler）：**
```javascript
const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)

// 左键点击
handler.setInputAction((movement) => {
    const position = movement.position  // 屏幕坐标（像素）
    // 处理点击
}, Cesium.ScreenSpaceEventType.LEFT_CLICK)

// 鼠标移动
handler.setInputAction((movement) => {
    const endPosition = movement.endPosition
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

// 右键点击（结束测量）
handler.setInputAction(() => {
    // 结束测量
}, Cesium.ScreenSpaceEventType.RIGHT_CLICK)

// 销毁事件监听
handler.destroy()
```

**场景拾取（scene.pick）：**
点击屏幕坐标后，用 `viewer.scene.pick()` 获取点击到的对象：

```javascript
handler.setInputAction((movement) => {
    const picked = viewer.scene.pick(movement.position)
    if (Cesium.defined(picked) && picked.id) {
        const entity = picked.id  // 拾取到的 Entity
        // 处理实体
    }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK)
```

**屏幕坐标转地理坐标：**
```javascript
// 方法1：pickEllipsoid（在地球表面，无地形时用）
const cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid)
const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
const lng = Cesium.Math.toDegrees(cartographic.longitude)
const lat = Cesium.Math.toDegrees(cartographic.latitude)
```

**建筑点击弹窗：**
1. 点击建筑 → scene.pick 获取 Entity
2. 从 Entity 的 properties 里取建筑信息
3. 或者调用后端点选接口获取完整属性
4. 弹窗用 HTML 元素（绝对定位），不是 Cesium 的 infoBox
5. 用 `scene.postRender` 事件实时更新弹窗位置，实现跟随地球旋转

```javascript
// 弹窗跟随地球
viewer.scene.postRender.addEventListener(() => {
    const canvasPosition = Cesium.SceneTransforms.wgs84ToWindowCoordinates(viewer.scene, position)
    if (canvasPosition) {
        popupStyle.value = { left: canvasPosition.x + 15 + 'px', top: canvasPosition.y - 30 + 'px' }
    }
})
```

**测距工具实现思路：**
1. 进入测距模式，注册鼠标事件
2. 左键点击 → 记录点坐标，添加点标记
3. 每两个点之间画一条线（Polyline）
4. 用 `EllipsoidGeodesic` 计算两点间地表距离
5. 在线段中点添加 Label 显示距离
6. 右键结束

```javascript
// 计算两点距离
const geodesic = new Cesium.EllipsoidGeodesic(
    Cesium.Cartographic.fromCartesian(point1),
    Cesium.Cartographic.fromCartesian(point2)
)
const distance = geodesic.surfaceDistance  // 单位：米
```

**测面积工具实现思路：**
1. 左键点击 → 记录点，添加点标记
2. 每加一个点，更新多边形（PolygonHierarchy）
3. 右键结束 → 计算多边形面积，显示 Label

### 项目代码示例

点击建筑调用后端点选接口：
```javascript
handler.setInputAction(async (movement) => {
    const picked = viewer.scene.pick(movement.position)
    if (Cesium.defined(picked) && picked.id) {
        const entity = picked.id
        const buildingType = entity._buildingType
        if (buildingType) {
            // 获取点击坐标
            const cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid)
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
            const lng = Cesium.Math.toDegrees(cartographic.longitude)
            const lat = Cesium.Math.toDegrees(cartographic.latitude)

            // 调用后端点选查询
            const detail = await pointQuery(tableName, lng, lat)
            mapStore.selectBuilding({ ...detail, lng, lat, position: cartesian })
        }
    }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK)
```

### 练习题 8

**题目 1（基础）**：实现一个点击事件，点击地球任意位置，在控制台输出该点的经纬度坐标。要求用 `pickEllipsoid` 获取坐标。

**题目 2（进阶）**：实现建筑点击高亮功能：
- 点击建筑时，该建筑颜色变为黄色
- 再次点击其他建筑时，之前的建筑恢复原色
- 点击空白处时，所有建筑恢复原色
- 提示：用 `entity.polygon.material` 动态设置颜色，需要保存原始颜色

**题目 3（挑战）**：实现测距工具：
- 点击"测距"按钮进入测距模式
- 左键连续打点，每两个点之间画线并显示距离
- 右键结束测距
- 提供"清除"按钮清除所有测量标记
- 距离格式：小于 1000 米显示 "xxx m"，大于等于 1000 米显示 "x.xx km"

**参考答案**：

```javascript
// 题目 1
const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
handler.setInputAction((movement) => {
    const cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid)
    if (cartesian) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
        const lng = Cesium.Math.toDegrees(cartographic.longitude)
        const lat = Cesium.Math.toDegrees(cartographic.latitude)
        console.log(`经度: ${lng.toFixed(6)}, 纬度: ${lat.toFixed(6)}`)
    }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK)
```

```javascript
// 题目 2
let selectedEntity = null
let originalColor = null

handler.setInputAction((movement) => {
    const picked = viewer.scene.pick(movement.position)
    // 恢复之前选中的颜色
    if (selectedEntity && originalColor) {
        selectedEntity.polygon.material = originalColor
    }
    if (Cesium.defined(picked) && picked.id && picked.id.polygon) {
        selectedEntity = picked.id
        originalColor = selectedEntity.polygon.material.getValue()
        selectedEntity.polygon.material = Cesium.Color.YELLOW.withAlpha(0.9)
    } else {
        selectedEntity = null
        originalColor = null
    }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK)
```

```javascript
// 题目 3 - 核心代码
let measurePositions = []
let measureEntities = []
let measureMode = false

function startMeasure() {
    measureMode = true
    measurePositions = []
    measureHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)

    measureHandler.setInputAction((movement) => {
        const cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid)
        if (!cartesian) return
        measurePositions.push(cartesian)

        // 添加点标记
        measureEntities.push(viewer.entities.add({
            position: cartesian,
            point: { pixelSize: 8, color: Cesium.Color.RED, outlineColor: Cesium.Color.WHITE, outlineWidth: 2 }
        }))

        if (measurePositions.length >= 2) {
            const p1 = measurePositions[measurePositions.length - 2]
            const p2 = cartesian
            // 画线
            measureEntities.push(viewer.entities.add({
                polyline: { positions: [p1, p2], width: 3, material: Cesium.Color.YELLOW }
            }))
            // 计算距离
            const geodesic = new Cesium.EllipsoidGeodesic(
                Cesium.Cartographic.fromCartesian(p1),
                Cesium.Cartographic.fromCartesian(p2)
            )
            const dist = geodesic.surfaceDistance
            const text = dist >= 1000 ? (dist / 1000).toFixed(2) + ' km' : dist.toFixed(2) + ' m'
            // 中点显示标签
            const mid = Cesium.Cartesian3.midpoint(p1, p2, new Cesium.Cartesian3())
            measureEntities.push(viewer.entities.add({
                position: mid,
                label: { text, font: '14px sans-serif', fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0, -10) }
            }))
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    measureHandler.setInputAction(() => {
        measureMode = false
        measureHandler.destroy()
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)
}

function clearMeasure() {
    measureEntities.forEach(e => viewer.entities.remove(e))
    measureEntities = []
    measurePositions = []
}
```

### 自测清单
- [ ] 能注册 Cesium 鼠标事件，知道 LEFT_CLICK、RIGHT_CLICK、MOUSE_MOVE 的区别
- [ ] 能用 scene.pick 获取点击到的 Entity
- [ ] 能把屏幕坐标转成经纬度坐标
- [ ] 能实现建筑点击弹窗，理解 postRender 跟随地球的原理
- [ ] 能实现测距工具，知道 EllipsoidGeodesic 计算地表距离
- [ ] 理解测量模式下要禁用建筑点击（避免冲突）

---

## 阶段 9：项目优化与部署

### 学习目标
- 理解前端打包和 Nginx 部署
- 掌握后端打包和运行
- 学会性能优化（瓦片、缓存、懒加载）
- 理解跨域问题的多种解决方案

### 核心概念

**前端打包：**
```bash
npm run build
```
生成 `dist/` 目录，里面是静态文件（HTML、CSS、JS、图片）。

**Nginx 部署前端：**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态资源
    location / {
        root /usr/share/nginx/html/dist;
        index index.html;
        try_files $uri $uri/ /index.html;  # Vue 路由 history 模式需要
    }

    # 反向代理后端 API
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
    }

    # 反向代理瓦片
    location /tiles/ {
        proxy_pass http://localhost:8080;
    }
}
```

**后端打包：**
```bash
mvn clean package -DskipTests
```
生成 `target/campus-digital-twin-1.0.0.jar`，运行：
```bash
java -jar campus-digital-twin-1.0.0.jar
```

**跨域问题的三种解决方案：**
1. **后端配置 CORS**（本项目用的方式）：`@CrossOrigin` 或 WebMvcConfigurer 配置允许的源
2. **前端开发代理**：Vite 的 `server.proxy` 配置，只在开发时生效
3. **Nginx 反向代理**：生产环境用 Nginx 把前端和后端放在同一个域名下，不存在跨域

**性能优化要点：**
1. **MVT 矢量瓦片**：不用一次加载全部数据，按需加载瓦片
2. **浏览器缓存**：瓦片接口设置 `Cache-Control: max-age=3600`
3. **图层懒加载**：默认只加载建筑，道路/场地按需加载
4. **Cesium 性能**：关闭不需要的控件，设置 `maximumLevel` 限制底图缩放级别
5. **前端打包优化**：`manualChunks` 把 cesium、element-plus 单独打包

### 练习题 9

**题目 1（基础）**：写一个 Nginx 配置，要求：
- 监听 80 端口
- 前端静态文件在 `/var/www/dist`
- `/api/` 反向代理到 `http://localhost:8080`
- `/tiles/` 反向代理到 `http://localhost:8080`

**题目 2（进阶）**：优化 Cesium Viewer 初始化，要求：
- 禁用所有不需要的控件
- 设置底图最大缩放级别为 18
- 开启地形深度检测
- 设置相机默认视角到校园中心，高度 500 米，俯视 60 度

**题目 3（挑战）**：实现 MVT 瓦片加载到 Cesium（提示：用 `Cesium.UrlTemplateImageryProvider` 不行，因为 MVT 是矢量数据不是图片。需要用第三方库 `cesium-mapbox-gl-style` 或自定义 ImageryProvider，或者简化为：前端直接调用 GeoJSON 接口加载全部数据，然后在前端做数据分片模拟瓦片效果）。

> 说明：MVT 瓦片在 Cesium 中加载比较复杂，MVP 阶段可以先用 GeoJSON 全量加载，面试时能讲清 MVT 原理和后端实现即可。

### 自测清单
- [ ] 知道前端打包命令和输出目录
- [ ] 知道后端打包命令和运行方式
- [ ] 能写基本的 Nginx 反向代理配置
- [ ] 能说清三种跨域解决方案的区别和适用场景
- [ ] 知道至少 3 种 WebGIS 性能优化手段

---

## 阶段 10：面试准备 — WebGIS 工程师求职

### 学习目标
- 梳理项目亮点和技术深度
- 准备常见面试题
- 学会把项目经验转化为面试话术
- 了解 WebGIS 工程师的技能要求

### 核心概念

**项目亮点梳理（面试时讲这些）：**

1. **PostGIS 空间查询**：
   - 用 `ST_Intersects` 实现点选查询
   - 用 `ST_DWithin` + `ST_Distance` 实现缓冲区查询和距离排序
   - 用 `ST_AsMVT` 原生生成矢量瓦片，不需要额外瓦片服务器
   - 动态表名 + 白名单校验，防止 SQL 注入

2. **Cesium 三维可视化**：
   - 建筑白模拉伸（`extrudedHeight`），按建筑类型着色
   - GeoJSON 数据加载和渲染
   - 自定义弹窗跟随地球旋转（`postRender` + `wgs84ToWindowCoordinates`）
   - 测距测面积工具（`EllipsoidGeodesic` + 多边形面积计算）

3. **前后端分离架构**：
   - Vue3 + Spring Boot REST API
   - Vite 代理解决开发跨域
   - Pinia 状态管理（图层、选中建筑、测量模式）

4. **工程化能力**：
   - 统一响应格式 + 全局异常处理
   - Swagger 接口文档
   - MyBatis-Plus + 动态 SQL（`<if>` 按表名选择列）
   - Lombok 简化代码

**常见面试题：**

| 问题 | 答题要点 |
|------|---------|
| PostGIS 和 MySQL 空间功能的区别？ | PostGIS 功能更完善，支持更多空间函数、拓扑、栅格；MySQL 空间功能基础，不支持拓扑运算 |
| 4326 和 3857 的区别？ | 4326 是 WGS84 经纬度，GPS 用；3857 是 Web Mercator 投影，Web 地图用，计算距离面积用米 |
| 为什么计算距离要 ST_Transform 到 3857？ | 4326 的单位是度，不是米，直接算距离结果不对；转成 3857 后单位是米 |
| Cesium 和 Three.js 的区别？ | Cesium 专门做 GIS，内置坐标系、投影、瓦片；Three.js 是通用 3D 引擎，GIS 能力要自己实现 |
| MVT 矢量瓦片和栅格瓦片的区别？ | 栅格是图片，样式固定；矢量是数据，前端自己渲染，可以改样式、可以点击交互 |
| 怎么防止 SQL 注入？ | 预编译参数 #{}；动态表名用 ${} 时必须加白名单校验 |
| 跨域怎么解决？ | 后端 CORS 配置、前端代理、Nginx 反向代理 |

**面试话术模板（STAR 法则）：**
- **S（Situation）**：项目背景——做了一个校园数字孪生 WebGIS 系统，用于校园三维可视化和空间查询
- **T（Task）**：我的任务——负责后端空间查询接口开发和前端 Cesium 三维可视化
- **A（Action）**：我做了什么——用 PostGIS 的 ST_AsMVT 实现矢量瓦片接口，用 Cesium 实现建筑白模拉伸和点击交互
- **R（Result）**：结果——系统支持 8 张空间表的查询，建筑点击响应时间 < 200ms，瓦片加载比全量加载快 60%

### 练习题 10

**题目 1（基础）**：用自己的话解释：什么是 MVT 矢量瓦片？它和普通图片瓦片相比有什么优势？

**题目 2（进阶）**：假设面试官问你"你的项目里遇到的最大技术难点是什么？怎么解决的？"，请写一段 200 字左右的回答，要求包含具体的技术细节和数据。

**题目 3（挑战）**：模拟面试：请为以下每个技术点写一个 1 分钟的自我介绍话术：
1. PostGIS 空间查询
2. Cesium 三维可视化
3. 前后端分离架构
4. 性能优化

### 自测清单
- [ ] 能说清项目的 4 个核心亮点
- [ ] 能回答 80% 的常见面试题
- [ ] 能用 STAR 法则讲项目经验
- [ ] 知道 WebGIS 工程师的核心技能要求
- [ ] 能把项目里的技术点转化为面试话术

---

## 学习路线总览

```
阶段 0  学前准备（环境搭建）
    ↓
阶段 1  空间数据库基础（PostGIS + 空间SQL）★★★★★
    ↓
阶段 2  后端基础（Spring Boot + REST API）★★★★
    ↓
阶段 3  MyBatis-Plus 与动态 SQL（数据访问层）★★★★
    ↓
阶段 4  空间查询接口实战（点选/缓冲区/MVT）★★★★★ 核心
    ↓
阶段 5  前端基础（Vue3 + Vite + Pinia）★★★★
    ↓
阶段 6  Cesium 三维可视化入门★★★★★ 核心
    ↓
阶段 7  前后端联调（数据加载与渲染）★★★★
    ↓
阶段 8  交互功能实战（点击/测量/弹窗）★★★★
    ↓
阶段 9  项目优化与部署★★★
    ↓
阶段 10 面试准备★★★★★ 求职关键
```

**重点阶段（必须掌握）**：阶段 1、4、6、10
**项目核心能力**：PostGIS 空间查询 + Cesium 三维可视化

---

## 推荐学习资源

- **PostGIS 官方文档**：https://postgis.net/documentation/
- **Cesium 官方教程**：https://cesium.com/learn/cesiumjs-learn/
- **Spring Boot 官方文档**：https://spring.io/projects/spring-boot
- **Vue3 官方文档**：https://cn.vuejs.org/
- **菜鸟教程 PostGIS**：搜索"PostGIS 教程"
- **B站**：搜索"Cesium 教程"、"WebGIS 教程"，有很多免费视频

---

> 最后提醒：学习 WebGIS 最好的方式是**边学边做**。每学完一个阶段，就回到项目里找到对应的代码，看懂它、改它、自己重写它。练习题一定要独立完成，不要先看答案。只有自己写过的代码，面试时才能讲清楚。
