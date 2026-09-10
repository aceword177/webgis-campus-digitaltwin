-- ============================================================
-- 安装 pgrouting 并构建无人机导航网格（A* 路径规划用）
-- ============================================================

-- 1. 安装 pgrouting 扩展
CREATE EXTENSION IF NOT EXISTS pgrouting;

-- 验证版本
SELECT pgr_version();

-- ============================================================
-- 2. 创建导航网格节点表
-- 基于校园边界范围，生成 15m 分辨率的网格中心点
-- ============================================================
DROP TABLE IF EXISTS drone_nav_node CASCADE;
CREATE TABLE drone_nav_node (
    id          SERIAL PRIMARY KEY,
    grid_col    INTEGER NOT NULL,
    grid_row    INTEGER NOT NULL,
    lng         NUMERIC(10,6) NOT NULL,
    lat         NUMERIC(10,6) NOT NULL,
    geom        geometry(Point, 4326) NOT NULL,
    is_walkable BOOLEAN DEFAULT true,
    CONSTRAINT uk_grid_cell UNIQUE (grid_col, grid_row)
);
COMMENT ON TABLE drone_nav_node IS '无人机导航网格节点表';
COMMENT ON COLUMN drone_nav_node.is_walkable IS '是否可飞行（与限飞区相交则为false）';

-- 空间索引
CREATE INDEX idx_drone_nav_node_geom ON drone_nav_node USING GIST (geom);

-- ============================================================
-- 3. 创建导航边表（相邻网格之间的连接）
-- ============================================================
DROP TABLE IF EXISTS drone_nav_edge CASCADE;
CREATE TABLE drone_nav_edge (
    id          SERIAL PRIMARY KEY,
    source      INTEGER NOT NULL REFERENCES drone_nav_node(id),
    target      INTEGER NOT NULL REFERENCES drone_nav_node(id),
    cost        NUMERIC(8,2) NOT NULL,
    reverse_cost NUMERIC(8,2) NOT NULL,
    x1          NUMERIC(10,6) NOT NULL,
    y1          NUMERIC(10,6) NOT NULL,
    x2          NUMERIC(10,6) NOT NULL,
    y2          NUMERIC(10,6) NOT NULL,
    geom        geometry(LineString, 4326)
);
COMMENT ON TABLE drone_nav_edge IS '无人机导航边表（A*路径规划用）';

CREATE INDEX idx_drone_nav_edge_geom ON drone_nav_edge USING GIST (geom);
CREATE INDEX idx_drone_nav_edge_source ON drone_nav_edge(source);
CREATE INDEX idx_drone_nav_edge_target ON drone_nav_edge(target);

-- ============================================================
-- 4. 生成网格节点
-- 基于校园边界的经纬度范围，15m 分辨率
-- 经纬度换算: 1度纬度 ≈ 111320m, 1度经度 ≈ 111320 * cos(lat) m
-- ============================================================
DO $$
DECLARE
    v_min_lng     NUMERIC;
    v_max_lng     NUMERIC;
    v_min_lat     NUMERIC;
    v_max_lat     NUMERIC;
    v_center_lat  NUMERIC;
    v_cell_size   NUMERIC := 15.0;  -- 网格分辨率 15米
    v_lng_step    NUMERIC;
    v_lat_step    NUMERIC;
    v_col_count   INTEGER;
    v_row_count   INTEGER;
    v_col         INTEGER;
    v_row         INTEGER;
    v_lng         NUMERIC;
    v_lat         NUMERIC;
    v_walkable    BOOLEAN;
    v_node_id     INTEGER;
BEGIN
    -- 获取校园边界范围
    SELECT ST_XMin(ST_Extent(geom)), ST_XMax(ST_Extent(geom)),
           ST_YMin(ST_Extent(geom)), ST_YMax(ST_Extent(geom)),
           ST_Y(ST_Centroid(ST_Extent(geom)))
    INTO v_min_lng, v_max_lng, v_min_lat, v_max_lat, v_center_lat
    FROM school;

    -- 扩大边界 50m，确保起点终点都在网格内
    v_min_lng := v_min_lng - 0.0005;
    v_max_lng := v_max_lng + 0.0005;
    v_min_lat := v_min_lat - 0.0005;
    v_max_lat := v_max_lat + 0.0005;

    -- 计算经纬度步长
    v_lat_step := v_cell_size / 111320.0;
    v_lng_step := v_cell_size / (111320.0 * COS(RADIANS(v_center_lat)));

    -- 计算行列数
    v_col_count := CEIL((v_max_lng - v_min_lng) / v_lng_step)::INTEGER;
    v_row_count := CEIL((v_max_lat - v_min_lat) / v_lat_step)::INTEGER;

    RAISE NOTICE '网格范围: lng % ~ %, lat % ~ %', v_min_lng, v_max_lng, v_min_lat, v_max_lat;
    RAISE NOTICE '网格分辨率: %m, 列数: %, 行数: %, 总节点数: %',
        v_cell_size, v_col_count, v_row_count, v_col_count * v_row_count;

    -- 生成网格节点
    FOR v_col IN 0..v_col_count-1 LOOP
        FOR v_row IN 0..v_row_count-1 LOOP
            v_lng := v_min_lng + (v_col + 0.5) * v_lng_step;
            v_lat := v_min_lat + (v_row + 0.5) * v_lat_step;

            -- 判断该网格是否与限飞区相交（用中心点判断，简化处理）
            SELECT NOT EXISTS (
                SELECT 1 FROM no_fly_zone nfz
                WHERE ST_Intersects(nfz.geom, ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326))
            ) INTO v_walkable;

            INSERT INTO drone_nav_node (grid_col, grid_row, lng, lat, geom, is_walkable)
            VALUES (v_col, v_row, v_lng, v_lat,
                    ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326), v_walkable);
        END LOOP;
    END LOOP;

    RAISE NOTICE '网格节点生成完成';
END $$;

-- 统计可飞行/不可飞行节点数
SELECT is_walkable, COUNT(*) FROM drone_nav_node GROUP BY is_walkable;

-- ============================================================
-- 5. 生成导航边（每个可飞行节点与周围8个相邻可飞行节点连接）
-- ============================================================
DO $$
DECLARE
    v_node        RECORD;
    v_neighbor    RECORD;
    v_cost        NUMERIC;
    v_edge_count  INTEGER := 0;
BEGIN
    -- 遍历每个可飞行节点
    FOR v_node IN SELECT id, grid_col, grid_row, lng, lat, geom
                   FROM drone_nav_node
                   WHERE is_walkable = true LOOP

        -- 查找周围8个相邻的可飞行节点
        FOR v_neighbor IN SELECT id, grid_col, grid_row, lng, lat, geom
                           FROM drone_nav_node
                           WHERE is_walkable = true
                             AND grid_col BETWEEN v_node.grid_col - 1 AND v_node.grid_col + 1
                             AND grid_row BETWEEN v_node.grid_row - 1 AND v_node.grid_row + 1
                             AND id > v_node.id  -- 避免重复边
                           ORDER BY id LOOP

            -- 计算边的代价 = 两点间距离（米）
            SELECT ST_Distance(
                ST_Transform(v_node.geom, 3857),
                ST_Transform(v_neighbor.geom, 3857)
            ) INTO v_cost;

            INSERT INTO drone_nav_edge (source, target, cost, reverse_cost,
                                         x1, y1, x2, y2, geom)
            VALUES (v_node.id, v_neighbor.id, v_cost, v_cost,
                    v_node.lng, v_node.lat, v_neighbor.lng, v_neighbor.lat,
                    ST_MakeLine(v_node.geom, v_neighbor.geom));

            v_edge_count := v_edge_count + 1;
        END LOOP;
    END LOOP;

    RAISE NOTICE '导航边生成完成，共 % 条边', v_edge_count;
END $$;

-- 统计
SELECT COUNT(*) AS total_nodes FROM drone_nav_node;
SELECT COUNT(*) AS walkable_nodes FROM drone_nav_node WHERE is_walkable = true;
SELECT COUNT(*) AS total_edges FROM drone_nav_edge;

-- ============================================================
-- 6. 测试 A* 路径规划
-- 示例: 从食堂1附近到某宿舍楼
-- ============================================================
DO $$
DECLARE
    v_start_id   INTEGER;
    v_end_id     INTEGER;
    v_start_lng  NUMERIC;
    v_start_lat  NUMERIC;
    v_end_lng    NUMERIC;
    v_end_lat    NUMERIC;
BEGIN
    -- 获取食堂1质心作为起点
    SELECT ST_X(ST_Centroid(ob.geom)), ST_Y(ST_Centroid(ob.geom))
    INTO v_start_lng, v_start_lat
    FROM restaurant r JOIN other_buildings ob ON r.building_id = ob.id
    WHERE r.id = 1;

    -- 获取1号宿舍楼质心作为终点
    SELECT ST_X(ST_Centroid(geom)), ST_Y(ST_Centroid(geom))
    INTO v_end_lng, v_end_lat
    FROM dormitory WHERE id = 1;

    -- 找最近的可飞行节点
    SELECT id INTO v_start_id FROM drone_nav_node
    WHERE is_walkable = true
    ORDER BY geom <-> ST_SetSRID(ST_MakePoint(v_start_lng, v_start_lat), 4326)
    LIMIT 1;

    SELECT id INTO v_end_id FROM drone_nav_node
    WHERE is_walkable = true
    ORDER BY geom <-> ST_SetSRID(ST_MakePoint(v_end_lng, v_end_lat), 4326)
    LIMIT 1;

    RAISE NOTICE '起点节点: %, 终点节点: %', v_start_id, v_end_id;

    -- 执行 A* 查询（用 RAISE NOTICE 输出结果）
    FOR v_start_id IN SELECT seq, path_seq, node, edge, cost, agg_cost
                        FROM pgr_astar(
                            'SELECT id, source, target, cost, x1, y1, x2, y2 FROM drone_nav_edge',
                            v_start_id, v_end_id, directed := false
                        ) LOOP
        RAISE NOTICE 'A* path: %', v_start_id;
    END LOOP;
END $$;

SELECT 'pgrouting 导航网格构建完成！' AS result;
