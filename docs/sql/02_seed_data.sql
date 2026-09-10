-- ============================================================
-- 校园无人机外卖配送系统 - 初始模拟数据
-- ============================================================

-- ============================================================
-- 1. 餐厅数据 (2条)
-- 食堂1: other_buildings id=4, 食堂2: id=7
-- ============================================================
INSERT INTO restaurant (id, building_id, name, window_count, open_time, rating, phone) VALUES
(1, 4, '食堂1', 10, '06:30-21:00', 4.6, '0311-88880001'),
(2, 7, '食堂2', 10, '07:00-21:30', 4.3, '0311-88880002');

-- ============================================================
-- 2. 外卖产品数据 (每个餐厅10个，共20条)
-- ============================================================
INSERT INTO product (restaurant_id, name, category, price, description, sales, status) VALUES
-- 食堂1
(1, '黄焖鸡米饭', '主食', 15.00, '秘制酱料，鸡肉鲜嫩', 328, 'on'),
(1, '番茄鸡蛋盖饭', '主食', 12.00, '家常口味，营养均衡', 256, 'on'),
(1, '红烧肉拌面', '主食', 14.00, '肥而不腻，面条劲道', 189, 'on'),
(1, '麻辣烫', '主食', 18.00, '自选食材，麻辣鲜香', 412, 'on'),
(1, '手抓饼', '小吃', 8.00, '外酥里嫩，加蛋加肠', 156, 'on'),
(1, '烤冷面', '小吃', 10.00, '东北特色，酸甜可口', 203, 'on'),
(1, '可乐', '饮品', 4.00, '冰镇可口可乐', 520, 'on'),
(1, '鲜榨橙汁', '饮品', 8.00, '新鲜橙子现榨', 98, 'on'),
(1, '商务套餐A', '套餐', 25.00, '一荤两素一汤+米饭', 167, 'on'),
(1, '商务套餐B', '套餐', 28.00, '两荤一素一汤+水果', 134, 'on'),
-- 食堂2
(2, '兰州拉面', '主食', 13.00, '手工拉面，汤鲜肉美', 389, 'on'),
(2, '扬州炒饭', '主食', 12.00, '粒粒分明，配料丰富', 234, 'on'),
(2, '水煮肉片', '主食', 20.00, '麻辣鲜香，肉片滑嫩', 278, 'on'),
(2, '沙县小吃套餐', '主食', 16.00, '拌面+炖罐+蒸饺', 198, 'on'),
(2, '肉夹馍', '小吃', 9.00, '腊汁肉，白吉馍', 267, 'on'),
(2, '煎饼果子', '小吃', 9.00, '天津风味，薄脆酱香', 223, 'on'),
(2, '雪碧', '饮品', 4.00, '冰镇雪碧', 445, 'on'),
(2, '绿豆汤', '饮品', 5.00, '清热解暑，冰镇更佳', 178, 'on'),
(2, '学生特惠餐', '套餐', 15.00, '一荤一素+米饭+汤', 356, 'on'),
(2, '营养早餐套餐', '套餐', 10.00, '包子+鸡蛋+豆浆', 289, 'on');

-- ============================================================
-- 3. 无人机数据 (10条)
-- 状态分布: 6 idle + 3 delivering + 1 charging
-- ============================================================
INSERT INTO drone (id, drone_no, model, max_payload_kg, max_range_km, battery_pct, status, current_lng, current_lat) VALUES
(1,  'UAV-001', 'DJI Matrice 30', 2.50, 5.0, 95, 'idle',       114.465000, 38.040000),
(2,  'UAV-002', 'DJI Matrice 30', 2.50, 5.0, 88, 'idle',       114.465200, 38.040200),
(3,  'UAV-003', 'DJI Matrice 30', 2.50, 5.0, 76, 'idle',       114.464800, 38.039800),
(4,  'UAV-004', 'DJI Mavic 3E',   2.00, 4.0, 92, 'idle',       114.465500, 38.040500),
(5,  'UAV-005', 'DJI Mavic 3E',   2.00, 4.0, 85, 'idle',       114.464500, 38.039500),
(6,  'UAV-006', 'DJI Mavic 3E',   2.00, 4.0, 80, 'idle',       114.466000, 38.041000),
(7,  'UAV-007', 'DJI Matrice 30', 2.50, 5.0, 65, 'delivering', 114.463000, 38.042000),
(8,  'UAV-008', 'DJI Matrice 30', 2.50, 5.0, 72, 'delivering', 114.467000, 38.038000),
(9,  'UAV-009', 'DJI Mavic 3E',   2.00, 4.0, 58, 'delivering', 114.462000, 38.041500),
(10, 'UAV-010', 'DJI Matrice 30', 2.50, 5.0, 25, 'charging',   114.465100, 38.040100);

-- ============================================================
-- 4. 限飞区数据 (9条: 2操场 + 7教学楼)
-- 从 playground 和 teaching_building 表导入 geom
-- ============================================================
INSERT INTO no_fly_zone (name, source_table, source_id, geom, level, reason)
SELECT name, 'playground', id, geom, 'strict', '运动场地，人员密集，禁飞'
FROM playground;

INSERT INTO no_fly_zone (name, source_table, source_id, geom, level, reason)
SELECT name, 'teaching_building', id, geom, 'strict', '教学区域，需保障教学秩序，禁飞'
FROM teaching_building;

-- ============================================================
-- 5. 配送订单数据 (40条)
-- 状态分布: 5 pending + 5 assigned + 10 delivering + 18 delivered + 2 cancelled
-- 用 PL/pgSQL 随机生成
-- ============================================================
DO $$
DECLARE
    v_order_id      INTEGER;
    v_restaurant_id INTEGER;
    v_dormitory_id  INTEGER;
    v_drone_id      INTEGER;
    v_status        VARCHAR(20);
    v_amount        NUMERIC(8,2);
    v_create_time   TIMESTAMP;
    v_items         TEXT;
    v_receiver      VARCHAR(20);
    v_phones        TEXT[] := ARRAY['138****1001','139****1002','137****1003','136****1004','135****1005','134****1006','133****1007','132****1008','131****1009','130****1010'];
    v_names         TEXT[] := ARRAY['张三','李四','王五','赵六','钱七','孙八','周九','吴十','郑十一','王十二','冯十三','陈十四','褚十五','卫十六','蒋十七','沈十八','韩十九','杨二十'];
    v_foods         TEXT[] := ARRAY['黄焖鸡米饭','番茄鸡蛋盖饭','红烧肉拌面','麻辣烫','兰州拉面','扬州炒饭','水煮肉片','手抓饼','烤冷面','肉夹馍','煎饼果子','可乐','雪碧','鲜榨橙汁','绿豆汤','商务套餐A','学生特惠餐','营养早餐套餐'];
    v_statuses      VARCHAR(20)[];
    i               INTEGER;
BEGIN
    -- 状态分布: 5 pending + 5 assigned + 10 delivering + 18 delivered + 2 cancelled
    v_statuses := ARRAY_FILL('pending'::VARCHAR, ARRAY[5]) ||
                  ARRAY_FILL('assigned'::VARCHAR, ARRAY[5]) ||
                  ARRAY_FILL('delivering'::VARCHAR, ARRAY[10]) ||
                  ARRAY_FILL('delivered'::VARCHAR, ARRAY[18]) ||
                  ARRAY_FILL('cancelled'::VARCHAR, ARRAY[2]);

    FOR i IN 1..40 LOOP
        v_restaurant_id := 1 + (random() * 1)::INT;
        v_dormitory_id  := 1 + (random() * 9)::INT;
        v_status        := v_statuses[i];
        v_amount        := ROUND((10 + random() * 30)::NUMERIC, 2);
        v_receiver      := v_names[1 + (random() * (array_length(v_names,1)-1))::INT];
        v_items         := v_foods[1 + (random() * (array_length(v_foods,1)-1))::INT] || 'x' || (1 + (random()*2)::INT)::TEXT;

        -- 下单时间: 最近3天内，集中在饭点(11-13点, 17-19点)
        v_create_time := NOW() - (random() * 3 * 24)::INT * INTERVAL '1 hour';
        -- 调整到饭点
        IF EXTRACT(HOUR FROM v_create_time) < 10 THEN
            v_create_time := v_create_time::DATE + INTERVAL '11:30';
        ELSIF EXTRACT(HOUR FROM v_create_time) BETWEEN 14 AND 16 THEN
            v_create_time := v_create_time::DATE + INTERVAL '17:30';
        END IF;

        -- 无人机分配: assigned/delivering/delivered 状态有 drone_id
        v_drone_id := NULL;
        IF v_status IN ('assigned', 'delivering', 'delivered') THEN
            v_drone_id := 1 + (random() * 9)::INT;
        END IF;

        INSERT INTO delivery_order (
            order_no, restaurant_id, dormitory_id, receiver_name, receiver_phone,
            items_text, amount, status, drone_id, create_time, assign_time, deliver_time, remark
        ) VALUES (
            'DD' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(i::TEXT, 4, '0'),
            v_restaurant_id, v_dormitory_id, v_receiver,
            v_phones[1 + (random() * (array_length(v_phones,1)-1))::INT],
            v_items, v_amount, v_status, v_drone_id,
            v_create_time,
            CASE WHEN v_status IN ('assigned','delivering','delivered') THEN v_create_time + INTERVAL '5 minutes' ELSE NULL END,
            CASE WHEN v_status = 'delivered' THEN v_create_time + INTERVAL '25 minutes' ELSE NULL END,
            CASE WHEN v_status = 'cancelled' THEN '用户取消' ELSE NULL END
        );
    END LOOP;
END $$;

-- ============================================================
-- 6. 飞行航线数据
-- 对 delivering 和 delivered 状态的订单生成航线
-- 起点: 餐厅建筑质心, 终点: 宿舍楼质心
-- 初始用直线，后续后端算法实现避让后更新
-- ============================================================
INSERT INTO flight_route (
    order_id, drone_id, start_lng, start_lat, end_lng, end_lat,
    route_geom, waypoints_count, distance_m, estimated_seconds, altitude_m, status
)
SELECT
    o.id,
    o.drone_id,
    ST_X(ST_Centroid(rb.geom)) AS start_lng,
    ST_Y(ST_Centroid(rb.geom)) AS start_lat,
    ST_X(ST_Centroid(d.geom)) AS end_lng,
    ST_Y(ST_Centroid(d.geom)) AS end_lat,
    ST_MakeLine(ST_Centroid(rb.geom), ST_Centroid(d.geom)) AS route_geom,
    0 AS waypoints_count,
    ROUND(ST_Length(ST_Transform(ST_MakeLine(ST_Centroid(rb.geom), ST_Centroid(d.geom)), 3857))::NUMERIC, 2) AS distance_m,
    ROUND(ST_Length(ST_Transform(ST_MakeLine(ST_Centroid(rb.geom), ST_Centroid(d.geom)), 3857)) / 8.0)::INT AS estimated_seconds,
    50.00 AS altitude_m,
    CASE WHEN o.status = 'delivered' THEN 'completed' ELSE 'flying' END AS status
FROM delivery_order o
JOIN restaurant r ON o.restaurant_id = r.id
JOIN other_buildings rb ON r.building_id = rb.id
JOIN dormitory d ON o.dormitory_id = d.id
WHERE o.status IN ('delivering', 'delivered')
  AND o.drone_id IS NOT NULL;

-- ============================================================
-- 数据统计验证
-- ============================================================
SELECT 'restaurant' AS table_name, COUNT(*) FROM restaurant
UNION ALL SELECT 'product', COUNT(*) FROM product
UNION ALL SELECT 'drone', COUNT(*) FROM drone
UNION ALL SELECT 'delivery_order', COUNT(*) FROM delivery_order
UNION ALL SELECT 'flight_route', COUNT(*) FROM flight_route
UNION ALL SELECT 'no_fly_zone', COUNT(*) FROM no_fly_zone
ORDER BY table_name;
