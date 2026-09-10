-- ============================================================
-- 校园无人机外卖配送系统 - 业务表建表脚本
-- 数据库: shp_data (PostgreSQL + PostGIS)
-- 原有8张空间表不动，新增6张业务表
-- ============================================================

-- 确保 PostGIS 扩展已启用
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- 表1: restaurant - 餐厅表
-- ============================================================
DROP TABLE IF EXISTS restaurant CASCADE;
CREATE TABLE restaurant (
    id              SERIAL PRIMARY KEY,
    building_id     INTEGER NOT NULL,
    name            VARCHAR(100) NOT NULL,
    window_count    INTEGER DEFAULT 10,
    open_time       VARCHAR(50) DEFAULT '07:00-21:00',
    rating          NUMERIC(2,1) DEFAULT 4.5,
    phone           VARCHAR(20),
    create_time     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE restaurant IS '餐厅表';
COMMENT ON COLUMN restaurant.building_id IS '关联 other_buildings.id';
COMMENT ON COLUMN restaurant.window_count IS '出餐窗口数（影响配送能力）';

-- ============================================================
-- 表2: product - 外卖产品表
-- ============================================================
DROP TABLE IF EXISTS product CASCADE;
CREATE TABLE product (
    id              SERIAL PRIMARY KEY,
    restaurant_id   INTEGER NOT NULL REFERENCES restaurant(id),
    name            VARCHAR(100) NOT NULL,
    category        VARCHAR(20) DEFAULT '主食',
    price           NUMERIC(6,2) NOT NULL,
    description     VARCHAR(255),
    image           VARCHAR(255),
    sales           INTEGER DEFAULT 0,
    status          VARCHAR(10) DEFAULT 'on',
    create_time     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE product IS '外卖产品表';
COMMENT ON COLUMN product.category IS '分类：主食/小吃/饮品/套餐';
COMMENT ON COLUMN product.status IS '状态：on(上架)/off(下架)';

-- ============================================================
-- 表3: drone - 无人机表
-- ============================================================
DROP TABLE IF EXISTS drone CASCADE;
CREATE TABLE drone (
    id                  SERIAL PRIMARY KEY,
    drone_no            VARCHAR(20) UNIQUE NOT NULL,
    model               VARCHAR(50) DEFAULT 'DJI Matrice 30',
    max_payload_kg      NUMERIC(4,2) DEFAULT 2.00,
    max_range_km        NUMERIC(4,1) DEFAULT 5.0,
    battery_pct         INTEGER DEFAULT 100,
    status              VARCHAR(20) DEFAULT 'idle',
    current_lng         NUMERIC(10,6),
    current_lat         NUMERIC(10,6),
    last_update_time    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    create_time         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE drone IS '无人机表';
COMMENT ON COLUMN drone.status IS '状态：idle(空闲)/delivering(配送中)/charging(充电)/maintenance(维护)';

-- ============================================================
-- 表4: delivery_order - 配送订单表
-- ============================================================
DROP TABLE IF EXISTS delivery_order CASCADE;
CREATE TABLE delivery_order (
    id              SERIAL PRIMARY KEY,
    order_no        VARCHAR(30) UNIQUE NOT NULL,
    restaurant_id   INTEGER NOT NULL REFERENCES restaurant(id),
    dormitory_id    INTEGER NOT NULL,
    receiver_name   VARCHAR(50),
    receiver_phone  VARCHAR(20),
    items_text      TEXT,
    amount          NUMERIC(8,2) DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'pending',
    drone_id        INTEGER REFERENCES drone(id),
    create_time     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assign_time     TIMESTAMP,
    deliver_time    TIMESTAMP,
    remark          VARCHAR(255)
);
COMMENT ON TABLE delivery_order IS '配送订单表';
COMMENT ON COLUMN delivery_order.dormitory_id IS '关联 dormitory.id（收货宿舍楼）';
COMMENT ON COLUMN delivery_order.status IS '状态：pending(待接单)/assigned(已分配)/delivering(配送中)/delivered(已送达)/cancelled(已取消)';

-- ============================================================
-- 表5: flight_route - 飞行航线表
-- ============================================================
DROP TABLE IF EXISTS flight_route CASCADE;
CREATE TABLE flight_route (
    id                  SERIAL PRIMARY KEY,
    order_id            INTEGER NOT NULL REFERENCES delivery_order(id),
    drone_id            INTEGER REFERENCES drone(id),
    start_lng           NUMERIC(10,6) NOT NULL,
    start_lat           NUMERIC(10,6) NOT NULL,
    end_lng             NUMERIC(10,6) NOT NULL,
    end_lat             NUMERIC(10,6) NOT NULL,
    route_geom          geometry(LineString, 4326),
    waypoints_count     INTEGER DEFAULT 0,
    distance_m          NUMERIC(8,2),
    estimated_seconds   INTEGER,
    altitude_m          NUMERIC(6,2) DEFAULT 50.00,
    status              VARCHAR(20) DEFAULT 'planned',
    create_time         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE flight_route IS '飞行航线表';
COMMENT ON COLUMN flight_route.route_geom IS '完整航线几何（含避让后的途径点）';
COMMENT ON COLUMN flight_route.status IS '状态：planned(已规划)/flying(飞行中)/completed(已完成)';

-- 航线几何索引
CREATE INDEX idx_flight_route_geom ON flight_route USING GIST (route_geom);

-- ============================================================
-- 表6: no_fly_zone - 限飞区表
-- ============================================================
DROP TABLE IF EXISTS no_fly_zone CASCADE;
CREATE TABLE no_fly_zone (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    source_table    VARCHAR(50),
    source_id       INTEGER,
    geom            geometry(MultiPolygon, 4326) NOT NULL,
    level           VARCHAR(20) DEFAULT 'strict',
    reason          VARCHAR(255),
    create_time     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE no_fly_zone IS '限飞区表';
COMMENT ON COLUMN no_fly_zone.level IS '等级：strict(严格禁飞)/warning(警示)';

-- 限飞区空间索引
CREATE INDEX idx_no_fly_zone_geom ON no_fly_zone USING GIST (geom);

-- ============================================================
-- 其他索引
-- ============================================================
CREATE INDEX idx_product_restaurant ON product(restaurant_id);
CREATE INDEX idx_order_restaurant ON delivery_order(restaurant_id);
CREATE INDEX idx_order_dormitory ON delivery_order(dormitory_id);
CREATE INDEX idx_order_status ON delivery_order(status);
CREATE INDEX idx_order_drone ON delivery_order(drone_id);
CREATE INDEX idx_route_order ON flight_route(order_id);
CREATE INDEX idx_route_drone ON flight_route(drone_id);
CREATE INDEX idx_drone_status ON drone(status);

SELECT '所有业务表创建完成！' AS result;
