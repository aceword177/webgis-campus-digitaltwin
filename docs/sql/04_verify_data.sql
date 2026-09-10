-- ============================================================
-- 数据验证脚本
-- ============================================================

\echo '========== 1. 各表数据量 =========='
SELECT 'restaurant' AS table_name, COUNT(*) FROM restaurant
UNION ALL SELECT 'product', COUNT(*) FROM product
UNION ALL SELECT 'drone', COUNT(*) FROM drone
UNION ALL SELECT 'delivery_order', COUNT(*) FROM delivery_order
UNION ALL SELECT 'flight_route', COUNT(*) FROM flight_route
UNION ALL SELECT 'no_fly_zone', COUNT(*) FROM no_fly_zone
ORDER BY table_name;

\echo ''
\echo '========== 2. 餐厅数据 =========='
SELECT r.id, r.name, r.window_count, r.rating, ob.name AS building_name
FROM restaurant r
JOIN other_buildings ob ON r.building_id = ob.id
ORDER BY r.id;

\echo ''
\echo '========== 3. 产品分类统计 =========='
SELECT restaurant_id, category, COUNT(*) AS cnt, ROUND(AVG(price),2) AS avg_price
FROM product
GROUP BY restaurant_id, category
ORDER BY restaurant_id, category;

\echo ''
\echo '========== 4. 无人机状态分布 =========='
SELECT status, COUNT(*) AS cnt, ROUND(AVG(battery_pct),1) AS avg_battery
FROM drone
GROUP BY status
ORDER BY status;

\echo ''
\echo '========== 5. 订单状态分布 =========='
SELECT status, COUNT(*) AS cnt, ROUND(AVG(amount),2) AS avg_amount
FROM delivery_order
GROUP BY status
ORDER BY status;

\echo ''
\echo '========== 6. 订单-餐厅-宿舍楼关联验证 =========='
SELECT o.order_no, r.name AS restaurant, d.name AS dormitory, o.status, o.amount
FROM delivery_order o
JOIN restaurant r ON o.restaurant_id = r.id
JOIN dormitory d ON o.dormitory_id = d.id
ORDER BY o.id
LIMIT 10;

\echo ''
\echo '========== 7. 航线数据验证（前5条） =========='
SELECT fr.id, fr.order_id, fr.drone_id,
       ROUND(fr.start_lng::numeric,4) AS start_lng, ROUND(fr.start_lat::numeric,4) AS start_lat,
       ROUND(fr.end_lng::numeric,4) AS end_lng, ROUND(fr.end_lat::numeric,4) AS end_lat,
       fr.distance_m, fr.estimated_seconds, fr.status,
       ST_AsText(fr.route_geom) AS route_wkt
FROM flight_route fr
ORDER BY fr.id
LIMIT 5;

\echo ''
\echo '========== 8. 航线状态分布 =========='
SELECT status, COUNT(*) AS cnt, ROUND(AVG(distance_m),2) AS avg_distance
FROM flight_route
GROUP BY status;

\echo ''
\echo '========== 9. 限飞区数据 =========='
SELECT id, name, source_table, level FROM no_fly_zone ORDER BY id;

\echo ''
\echo '========== 10. 航线穿越限飞区检测（初始直线航线） =========='
SELECT fr.id AS route_id, fr.order_id, nfz.name AS crossed_zone
FROM flight_route fr
JOIN no_fly_zone nfz ON ST_Intersects(fr.route_geom, nfz.geom)
ORDER BY fr.id;

\echo ''
\echo '========== 验证完成 =========='
