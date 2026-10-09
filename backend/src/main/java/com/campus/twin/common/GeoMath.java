package com.campus.twin.common;

/**
 * 地理计算工具（纯函数，无 Spring / 数据库依赖，便于单测）。
 *
 * <p>集中放置全项目共用的距离与落点算法，避免同一段 haversine 在多个服务里各写一遍
 * （重构前 {@code OrderServiceImpl}、{@code DroneServiceImpl}、{@code CanteenLocator}
 * 各有一份实现，口径容易漂移）。
 */
public final class GeoMath {

    private GeoMath() {
    }

    /** 地球平均半径（米） */
    public static final double EARTH_RADIUS_M = 6371000.0;

    /** 1 度纬度的近似长度（米），用于米↔度的快速换算 */
    public static final double METERS_PER_DEG_LAT = 111320.0;

    /** 黄金角（弧度）：按序号递增时可均匀铺满圆周，避免点扎堆 */
    public static final double GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

    /**
     * 两点间大圆距离（米）。
     * 与 PostGIS 的 {@code ST_Length(...::geography)} / {@code ST_Distance(...::geography)}
     * 同为球面口径，因此与航线 {@code distance_m}、路径时间保持一致的量级。
     */
    public static double haversine(double lng1, double lat1, double lng2, double lat2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /**
     * 在给定圆心周边生成一个**确定性**散点（同一 {@code seed} 恒定得到同一坐标）。
     *
     * <p>为什么强调确定性：若用随机散布，让无人机"归位食堂"的任务在下一周期
     * 会再次因"距食堂 &gt; 阈值"判定需要移动，于是每次重新随机、反复写库，
     * 坐标在轮询周期上持续抖动。改为按 id 推导后该问题自然消失，且行为可复现、可测试。
     *
     * @param centerLng 圆心经度
     * @param centerLat 圆心纬度
     * @param seed      确定性种子（一般传实体 id）
     * @param baseM     基础半径（米）
     * @param spreadM   在基础半径之上的额外跨度（米），结果半径落在 [baseM, baseM+spreadM)
     * @return {@code double[]{lng, lat}}
     */
    public static double[] deterministicOffsetPoint(double centerLng, double centerLat,
                                                     int seed, double baseM, double spreadM) {
        double angle = (seed * GOLDEN_ANGLE) % (2 * Math.PI);
        double dist = baseM + (Math.abs(seed) % 3) * (spreadM / 2.0);
        double dLat = dist * Math.cos(angle) / METERS_PER_DEG_LAT;
        double cosLat = Math.cos(Math.toRadians(centerLat));
        double dLng = cosLat == 0 ? 0 : dist * Math.sin(angle) / (METERS_PER_DEG_LAT * cosLat);
        return new double[]{centerLng + dLng, centerLat + dLat};
    }
}
