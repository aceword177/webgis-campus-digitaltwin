package com.campus.twin.service;

import com.campus.twin.common.GeoJsonSupport;
import com.campus.twin.common.GeoMath;
import com.campus.twin.entity.Restaurant;
import com.campus.twin.mapper.RestaurantMapper;
import com.campus.twin.mapper.SpatialQueryMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * 食堂位置定位器：全校唯一的"食堂在哪"数据来源。
 *
 * <p><b>为什么需要它</b>：此前 {@code DroneServiceImpl} 与 {@code OrderServiceImpl}
 * **各自维护了一份 {@code findNearestCanteen}**，实现还不一致（一处把 centroid 按
 * {@code String} 强转并静默跳过，一处走解析失败即抛异常的路径）。
 * 两份代码的调用频率都很高：
 * <ul>
 *   <li>{@code repositionIdleDronesToCanteen} 每 15 秒 × 每架空闲无人机；</li>
 *   <li>{@code chargeDrones} 每 15 秒 × 每架充电中无人机；</li>
 *   <li>{@code confirmDeliver} 每次送达后。</li>
 * </ul>
 * 而每次调用都是"餐厅全表 + 逐条查 other_buildings 质心"的 N+1 查询。
 *
 * <p><b>本类的三个改进</b>：
 * <ol>
 *   <li><b>缓存</b>：食堂是静态数据（{@code docs/sql/02_seed_data.sql} 只有 2 家），
 *       质心缓存 {@link #CACHE_TTL}，把每 15 秒数十次查询降到每小时数次；</li>
 *   <li><b>统一解析</b>：centroid 一律走 {@link GeoJsonSupport}，消除两套实现；</li>
 *   <li><b>确定性落点</b>：充电/待命落点由无人机 id 推导（黄金角散布），
 *       同一架无人机每次得到同一坐标——替换原先的随机散布，
 *       避免坐标在 15s 周期上反复抖动并触发无意义写库。</li>
 * </ol>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CanteenLocator {

    private final RestaurantMapper restaurantMapper;
    private final SpatialQueryMapper spatialQueryMapper;
    private final ObjectMapper objectMapper;

    /** 食堂列表关联的建筑表名（restaurant.building_id → other_buildings.id） */
    private static final String BUILDING_TABLE = "other_buildings";

    /** 质心缓存有效期：食堂位置属静态数据，无需高频查询 */
    private static final Duration CACHE_TTL = Duration.ofSeconds(60);

    /** 充电/待命落点距食堂质心的基准半径（米） */
    private static final double SPOT_BASE_RADIUS_M = 2.0;

    /** 充电/待命落点在基准半径上的额外散布跨度（米） */
    private static final double SPOT_SPREAD_M = 4.0;

    /** 缓存快照，不可变；读取无需加锁 */
    private volatile List<Canteen> cache = List.of();
    private volatile LocalDateTime cacheAt = LocalDateTime.MIN;

    /** 一个食堂的位置 */
    public record Canteen(Integer id, String name, double lng, double lat) {
    }

    /** 取全部食堂位置（带缓存） */
    public List<Canteen> all() {
        LocalDateTime now = LocalDateTime.now();
        List<Canteen> snapshot = cache;
        if (!snapshot.isEmpty() && Duration.between(cacheAt, now).compareTo(CACHE_TTL) < 0) {
            return snapshot;
        }
        return refresh(now);
    }

    private synchronized List<Canteen> refresh(LocalDateTime now) {
        // 双检：并发进入时避免重复加载
        List<Canteen> snapshot = cache;
        if (!snapshot.isEmpty() && Duration.between(cacheAt, now).compareTo(CACHE_TTL) < 0) {
            return snapshot;
        }
        List<Restaurant> restaurants = restaurantMapper.selectList(null);
        List<Canteen> loaded = new ArrayList<>();
        for (Restaurant r : restaurants) {
            if (r.getBuildingId() == null) {
                continue;
            }
            Map<String, Object> building = spatialQueryMapper.selectById(BUILDING_TABLE, r.getBuildingId());
            double[] c = GeoJsonSupport.parseCentroid(building, objectMapper);
            if (c == null) {
                log.warn("食堂 {} 的建筑(id={})缺少可用质心，跳过", r.getName(), r.getBuildingId());
                continue;
            }
            loaded.add(new Canteen(r.getId(), r.getName(), c[0], c[1]));
        }
        if (loaded.isEmpty()) {
            // 不缓存空结果：数据可能尚未就绪，下次调用应重试
            log.warn("未能解析出任何食堂坐标，本次不做缓存");
            return cache;
        }
        cache = Collections.unmodifiableList(loaded);
        cacheAt = now;
        log.debug("食堂位置缓存已刷新，共 {} 个", loaded.size());
        return cache;
    }

    /**
     * 找离给定坐标最近的食堂。
     *
     * @return 最近的食堂；无可用数据时返回 {@code null}（调用方须判空）
     */
    public Canteen nearest(double lng, double lat) {
        Canteen best = null;
        double bestDist = Double.MAX_VALUE;
        for (Canteen c : all()) {
            double d = GeoMath.haversine(lng, lat, c.lng(), c.lat());
            if (d < bestDist) {
                bestDist = d;
                best = c;
            }
        }
        return best;
    }

    /**
     * 计算某架无人机的充电/待命落点：最近食堂质心周边、由 id 决定的确定性散点。
     *
     * <p>用确定性而非随机散布的原因：落点若每次不同，归位任务下一周期
     * 会因"距食堂 &gt; 20m"判定再次挪动并写库，坐标持续抖动。
     * 同一架无人机始终得到同一落点后，该问题自然消失。
     * 具体算法在 {@link GeoMath#deterministicOffsetPoint}，已单测覆盖。
     *
     * @return {@code double[]{lng, lat}}；无可用食堂时返回 {@code null}
     */
    public double[] parkingSpotFor(Integer droneId, double fromLng, double fromLat) {
        Canteen canteen = nearest(fromLng, fromLat);
        if (canteen == null) {
            return null;
        }
        return GeoMath.deterministicOffsetPoint(
                canteen.lng(), canteen.lat(), droneId != null ? droneId : 0,
                SPOT_BASE_RADIUS_M, SPOT_SPREAD_M);
    }

    /** 清空缓存（食堂数据变更后可主动调用；测试亦可用） */
    public synchronized void invalidate() {
        cache = List.of();
        cacheAt = LocalDateTime.MIN;
    }
}
