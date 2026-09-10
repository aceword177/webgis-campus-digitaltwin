-- 修复限飞区几何类型为 MultiPolygon 并重新导入数据
ALTER TABLE no_fly_zone ALTER COLUMN geom TYPE geometry(MultiPolygon, 4326);
DROP INDEX IF EXISTS idx_no_fly_zone_geom;
CREATE INDEX idx_no_fly_zone_geom ON no_fly_zone USING GIST (geom);

-- 清空旧数据（如果有）
DELETE FROM no_fly_zone;

-- 从操场导入
INSERT INTO no_fly_zone (name, source_table, source_id, geom, level, reason)
SELECT name, 'playground', id, geom, 'strict', '运动场地，人员密集，禁飞'
FROM playground;

-- 从教学楼导入
INSERT INTO no_fly_zone (name, source_table, source_id, geom, level, reason)
SELECT name, 'teaching_building', id, geom, 'strict', '教学区域，需保障教学秩序，禁飞'
FROM teaching_building;

-- 验证
SELECT id, name, source_table, level FROM no_fly_zone ORDER BY id;
SELECT COUNT(*) AS total_no_fly_zones FROM no_fly_zone;
