-- ============================================================
-- 建筑点击弹窗 - 属性字段扩充
-- ============================================================
--
-- 背景：点击建筑弹出的信息浮窗需要展示业务属性，而原始空间表
--       只有 id/name/height/几何，没有可展示的业务信息。
--
-- 手工已完成的改动（本脚本不重复执行，仅作记录）：
--   · dormitory.gender            VARCHAR(50)  —— 宿舍性别：男 / 女
--   · teaching_building.dept_name VARCHAR(50)  —— 所属院系
--
-- 本脚本负责：
--   · teaching_building.description  —— 学院简介（弹窗展示）
--   · 填充各学院简介初稿（可随时用 UPDATE 覆盖）
--
-- 幂等：重复执行只覆盖 description 文案，不报错、不重复加列。
-- 执行：psql -h localhost -U postgres -d shp_data -f docs/sql/06_add_building_profile.sql
-- ============================================================

-- ---------- 1. 加字段 ----------
ALTER TABLE teaching_building
    ADD COLUMN IF NOT EXISTS description VARCHAR(255);

COMMENT ON COLUMN teaching_building.description IS '学院/建筑简介，用于地图点击弹窗展示';

-- ---------- 2. 填充简介初稿 ----------
-- 说明：按各学院（实训楼）的定位撰写，仅作占位文案，可随时替换。

UPDATE teaching_building SET description =
    '商学院立足区域经济发展，设有工商管理、市场营销、会计学等专业，建有企业经营沙盘模拟实训室与商务数据分析实验室，注重案例教学与产教融合。'
    WHERE id = 1;

UPDATE teaching_building SET description =
    '土木建筑学院开设土木工程、工程管理等专业，拥有结构力学实验室、建筑材料检测中心与BIM技术应用中心，聚焦工程实践能力培养。'
    WHERE id = 2;

UPDATE teaching_building SET description =
    '人工智能学院聚焦机器学习、计算机视觉与智能机器人方向，设有智能计算实验室与AI创新实践基地，承担多项人工智能应用研究课题。'
    WHERE id = 3;

UPDATE teaching_building SET description =
    '网络空间安全学院面向网络安全与数据安全领域，建设网络攻防演练靶场与信息安全实验室，开展渗透测试、密码学等方向的教学与实训。'
    WHERE id = 4;

UPDATE teaching_building SET description =
    '实训楼以工程实训与技能训练为主，配备机械加工、电子电工等实训车间，是学生开展课程实践、学科竞赛与创新项目的共享平台。'
    WHERE id = 5;

UPDATE teaching_building SET description =
    '人工智能学院聚焦机器学习、计算机视觉与智能机器人方向，设有智能计算实验室与AI创新实践基地，承担多项人工智能应用研究课题。'
    WHERE id = 6;

UPDATE teaching_building SET description =
    '艺术与传媒学院设有视觉传达设计、环境设计、数字媒体艺术等专业，配有摄影棚、非线性编辑机房与设计工作室，强调创意表达与媒介实践。'
    WHERE id = 7;

-- ---------- 3. 校验 ----------
SELECT id, name, dept_name, LEFT(description, 20) || '...' AS description_preview
FROM teaching_building
ORDER BY id;

SELECT id, name, gender
FROM dormitory
ORDER BY id;
