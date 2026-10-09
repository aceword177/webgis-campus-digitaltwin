package com.campus.twin.common;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * {@link GeoMath} 单元测试（纯函数，无需 Spring / 数据库）。
 *
 * <p>锁住两件影响面很大的事：
 * <ol>
 *   <li><b>距离口径</b>——haversine 是全项目的距离基准（路径时间、送达判定、
 *       覆盖分档都依赖它），且必须与 PostGIS 的 {@code geography} 口径同量级；</li>
 *   <li><b>落点确定性</b>——充电/待命落点必须由无人机 id 唯一决定。
 *       原实现是随机散布，导致归位任务下一周期又判定"距食堂 &gt; 20m"而再次挪动并写库，
 *       坐标在 15 秒周期上持续抖动。这条测试防止该问题回归。</li>
 * </ol>
 */
class GeoMathTest {

    private static final double CAMPUS_LNG = 114.4704;
    private static final double CAMPUS_LAT = 37.9832;

    @Test
    @DisplayName("haversine：同一点距离为 0")
    void samePointIsZero() {
        assertEquals(0.0, GeoMath.haversine(CAMPUS_LNG, CAMPUS_LAT, CAMPUS_LNG, CAMPUS_LAT), 1e-6);
    }

    @Test
    @DisplayName("haversine：纬度差 0.001 度 ≈ 111.32 米")
    void oneThousandthDegreeLatitude() {
        double d = GeoMath.haversine(CAMPUS_LNG, 37.980, CAMPUS_LNG, 37.981);
        assertEquals(111.32, d, 1.2);
    }

    @Test
    @DisplayName("haversine：经度方向的距离按纬度做 cos 收缩（校园纬度约 0.788 倍）")
    void longitudeDistanceShrinksWithLatitude() {
        double atEquator = GeoMath.haversine(0.0, 0.0, 0.001, 0.0);
        double atCampus = GeoMath.haversine(114.470, 37.984, 114.471, 37.984);
        double expected = atEquator * Math.cos(Math.toRadians(37.984));
        assertEquals(expected, atCampus, 1.0);
        assertTrue(atCampus < atEquator, "高纬度处同经度差对应的地面距离应更短");
    }

    @Test
    @DisplayName("haversine：对称且非负")
    void isSymmetricAndPositive() {
        double ab = GeoMath.haversine(114.4704, 37.9832, 114.4683, 37.9842);
        double ba = GeoMath.haversine(114.4683, 37.9842, 114.4704, 37.9832);
        assertEquals(ab, ba, 1e-9);
        assertTrue(ab > 0);
    }

    @Test
    @DisplayName("haversine：与 PostGIS geography 口径同量级（食堂1 → 1 号宿舍楼约数百米）")
    void matchesExpectedCampusScale() {
        // 食堂1质心 → 某宿舍楼质心，实测直线距离在数百米级；
        // 用宽松区间断言"量级正确"，主要防止把度当成米之类的单位错误
        double d = GeoMath.haversine(114.470403771, 37.983181951, 114.472197, 37.986209);
        assertTrue(d > 100 && d < 600, "校园内两点距离应为数百米级，实际 " + d + "m");
    }

    @Test
    @DisplayName("deterministicOffsetPoint：同一 seed 恒定得到同一落点")
    void offsetPointIsDeterministic() {
        double[] a = GeoMath.deterministicOffsetPoint(CAMPUS_LNG, CAMPUS_LAT, 3, 2.0, 4.0);
        double[] b = GeoMath.deterministicOffsetPoint(CAMPUS_LNG, CAMPUS_LAT, 3, 2.0, 4.0);
        assertEquals(a[0], b[0], 1e-15);
        assertEquals(a[1], b[1], 1e-15);
    }

    @Test
    @DisplayName("deterministicOffsetPoint：落点落在 0.5~10m 的合理散布范围内")
    void offsetPointStaysNearCenter() {
        for (int seed = 1; seed <= 20; seed++) {
            double[] p = GeoMath.deterministicOffsetPoint(CAMPUS_LNG, CAMPUS_LAT, seed, 2.0, 4.0);
            double d = GeoMath.haversine(CAMPUS_LNG, CAMPUS_LAT, p[0], p[1]);
            assertTrue(d > 0.5 && d < 10.0,
                    "seed=" + seed + " 落点距圆心 " + d + "m，应落在 0.5~10m");
        }
    }

    @Test
    @DisplayName("deterministicOffsetPoint：不同 seed 应散开，不会全部重叠")
    void offsetPointsAreSpreadOut() {
        double[] a = GeoMath.deterministicOffsetPoint(CAMPUS_LNG, CAMPUS_LAT, 1, 2.0, 4.0);
        double[] b = GeoMath.deterministicOffsetPoint(CAMPUS_LNG, CAMPUS_LAT, 2, 2.0, 4.0);
        double between = GeoMath.haversine(a[0], a[1], b[0], b[1]);
        assertTrue(between > 0.2, "相邻 seed 的落点应至少分开 0.2m，实际 " + between + "m");
    }
}
