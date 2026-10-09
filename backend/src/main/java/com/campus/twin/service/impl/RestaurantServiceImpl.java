package com.campus.twin.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.campus.twin.dto.CanteenCoverageVO;
import com.campus.twin.dto.DormitoryCoverageVO;
import com.campus.twin.dto.RestaurantDetailVO;
import com.campus.twin.dto.TierCoverageVO;
import com.campus.twin.entity.Restaurant;
import com.campus.twin.mapper.NavigationMapper;
import com.campus.twin.mapper.RestaurantMapper;
import com.campus.twin.mapper.SpatialQueryMapper;
import com.campus.twin.service.RestaurantService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RestaurantServiceImpl implements RestaurantService {

    private final RestaurantMapper restaurantMapper;
    private final SpatialQueryMapper spatialQueryMapper;
    private final NavigationMapper navigationMapper;
    private final ObjectMapper objectMapper;

    private static final double FLIGHT_SPEED = 5.0;

    /** 可达区走廊半宽（米）：把实际航线扩成面时的缓冲宽度，仅为可视化 */
    private static final double REACH_CORRIDOR_HALF_WIDTH_M = 25.0;

    /** 覆盖结果缓存有效期：校园空间数据静态，无需每次请求重算 20 次 A* */
    private static final Duration CACHE_TTL = Duration.ofMinutes(5);

    /** 覆盖结果缓存快照（不可变） */
    private record CoverageCache(List<CanteenCoverageVO> data, LocalDateTime at) {
    }

    private volatile CoverageCache coverageCache;

    @Override
    public List<Restaurant> list() {
        return restaurantMapper.selectList(null);
    }

    @Override
    public RestaurantDetailVO getDetail(Integer id) {
        Restaurant restaurant = restaurantMapper.selectById(id);
        if (restaurant == null) {
            return null;
        }

        // 查询关联建筑的空间信息
        Map<String, Object> building = spatialQueryMapper.selectById("other_buildings", restaurant.getBuildingId());

        RestaurantDetailVO.RestaurantDetailVOBuilder builder = RestaurantDetailVO.builder()
                .id(restaurant.getId())
                .buildingId(restaurant.getBuildingId())
                .name(restaurant.getName())
                .windowCount(restaurant.getWindowCount())
                .openTime(restaurant.getOpenTime())
                .rating(restaurant.getRating())
                .phone(restaurant.getPhone());

        if (building != null) {
            builder.buildingGeojson((String) building.get("geom"));
            // centroid 是 ST_AsGeoJSON 返回的 JSON 字符串，需要解析
            String centroidStr = (String) building.get("centroid");
            if (centroidStr != null) {
                try {
                    Map<String, Object> centroid = objectMapper.readValue(centroidStr, Map.class);
                    List<Double> coords = (List<Double>) centroid.get("coordinates");
                    if (coords != null && coords.size() >= 2) {
                        builder.centerLng(coords.get(0));
                        builder.centerLat(coords.get(1));
                    }
                } catch (Exception e) {
                    log.warn("解析餐厅建筑质心失败: {}", e.getMessage());
                }
            }
        }

        return builder.build();
    }

    @Override
    public Restaurant getById(Integer id) {
        return restaurantMapper.selectById(id);
    }

    @Override
    public List<CanteenCoverageVO> getCoverage() {
        // 覆盖分析要做 2 食堂 × 10 宿舍 ≈ 20 次 pgr_astar + 20 次最近节点 KNN，
        // 而校园空间数据是静态的：结果缓存 CACHE_TTL，避免每次前端加载都全量重算。
        CoverageCache cached = coverageCache;
        if (cached != null && Duration.between(cached.at(), LocalDateTime.now()).compareTo(CACHE_TTL) < 0) {
            return cached.data();
        }
        List<CanteenCoverageVO> computed = computeCoverage();
        if (!computed.isEmpty()) {
            coverageCache = new CoverageCache(computed, LocalDateTime.now());
        }
        return computed;
    }

    private List<CanteenCoverageVO> computeCoverage() {
        List<Restaurant> restaurants = restaurantMapper.selectList(null);
        List<Map<String, Object>> dorms = spatialQueryMapper.findDormitoryCentroids();
        List<CanteenCoverageVO> result = new ArrayList<>();
        if (restaurants == null || dorms == null || dorms.isEmpty()) {
            return result;
        }
        for (Restaurant r : restaurants) {
            RestaurantDetailVO detail = getDetail(r.getId());
            if (detail == null || detail.getCenterLng() == null || detail.getCenterLat() == null) {
                continue;
            }
            Integer startNode = nearestWalkableNode(detail.getCenterLng(), detail.getCenterLat());
            if (startNode == null) {
                continue;
            }
            List<DormitoryCoverageVO> all = new ArrayList<>();
            // 宿舍 id → 该宿舍的实际航线 GeoJSON（用于后面按档并集成面）
            Map<Integer, String> pathByDorm = new LinkedHashMap<>();
            for (Map<String, Object> dorm : dorms) {
                Number dormId = (Number) dorm.get("id");
                String dormName = (String) dorm.get("name");
                double lng = ((Number) dorm.get("lng")).doubleValue();
                double lat = ((Number) dorm.get("lat")).doubleValue();
                Integer endNode = nearestWalkableNode(lng, lat);
                if (endNode == null) {
                    continue;
                }
                List<Map<String, Object>> path = navigationMapper.findShortestPath(startNode, endNode);
                if (path == null || path.isEmpty()) {
                    continue; // A* 不可达，不计入任何档
                }
                List<Integer> nodeIds = path.stream()
                        .sorted((a, b) -> Integer.compare(
                                ((Number) a.get("path_seq")).intValue(),
                                ((Number) b.get("path_seq")).intValue()))
                        .map(m -> ((Number) m.get("node")).intValue())
                        .collect(Collectors.toList());
                String nodeIdsStr = "{" + nodeIds.stream().map(String::valueOf).collect(Collectors.joining(",")) + "}";
                Map<String, Object> routeData = navigationMapper.buildRouteFromNodes(nodeIdsStr);
                double distanceM = routeData.get("distance_m") != null
                        ? ((Number) routeData.get("distance_m")).doubleValue() : 0.0;
                int seconds = (int) Math.ceil(distanceM / FLIGHT_SPEED);
                all.add(DormitoryCoverageVO.builder()
                        .id(dormId.intValue())
                        .name(dormName)
                        .distanceM(distanceM)
                        .seconds(seconds)
                        .lng(lng)
                        .lat(lat)
                        .build());
                // 记录该宿舍的实际路径，供分档并集成面
                Map<String, Object> pathGeo = navigationMapper.buildPathGeojson(nodeIdsStr);
                if (pathGeo != null && pathGeo.get("path_geojson") != null) {
                    pathByDorm.put(dormId.intValue(), (String) pathGeo.get("path_geojson"));
                }
            }
            all.sort(Comparator.comparingInt(DormitoryCoverageVO::getSeconds));
            List<TierCoverageVO> tiers = new ArrayList<>();
            for (int sec : new int[]{30, 60, 90}) {
                List<DormitoryCoverageVO> inTier = all.stream()
                        .filter(d -> d.getSeconds() <= sec)
                        .collect(Collectors.toList());
                Double maxDist = inTier.stream()
                        .map(DormitoryCoverageVO::getDistanceM)
                        .filter(Objects::nonNull)
                        .max(Double::compareTo)
                        .orElse(0.0);
                tiers.add(TierCoverageVO.builder()
                        .seconds(sec)
                        // radius 保留仅为兼容旧前端；新前端请用 reachGeojson
                        .radius(sec * FLIGHT_SPEED)
                        .dormitories(inTier)
                        .reachGeojson(buildTierReachGeojson(inTier, pathByDorm))
                        .maxDistanceM(maxDormDistance(inTier))
                        .build());
            }
            result.add(CanteenCoverageVO.builder()
                    .canteenId(r.getId())
                    .name(r.getName())
                    .centerLng(detail.getCenterLng())
                    .centerLat(detail.getCenterLat())
                    .tiers(tiers)
                    .build());
        }
        return result;
    }

    /** 该档覆盖宿舍中的最远实走距离（与 maxDist 同源，抽出便于阅读） */
    private Double maxDormDistance(List<DormitoryCoverageVO> inTier) {
        return inTier.stream()
                .map(DormitoryCoverageVO::getDistanceM)
                .filter(Objects::nonNull)
                .max(Double::compareTo)
                .orElse(0.0);
    }

    /**
     * 把该档覆盖宿舍的**实际航线**缓冲成面，返回 GeoJSON。
     *
     * <p>这样"地图上画出来的可达区"与"面板里列出的宿舍"来自同一份数据，
     * 不会再出现圆与列表不一致的问题。缓冲宽度取走廊半宽，仅用于让线可见。
     */
    private String buildTierReachGeojson(List<DormitoryCoverageVO> inTier,
                                         Map<Integer, String> pathByDorm) {
        if (inTier.isEmpty()) {
            return null;
        }
        List<String> paths = inTier.stream()
                .map(d -> pathByDorm.get(d.getId()))
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        if (paths.isEmpty()) {
            return null;
        }
        try {
            Map<String, Object> row = navigationMapper.buildReachPolygon(paths, REACH_CORRIDOR_HALF_WIDTH_M);
            return row != null ? (String) row.get("reach_geojson") : null;
        } catch (Exception e) {
            // 可达区面只是可视化增强，失败不应让整个覆盖接口挂掉
            log.warn("生成可达区面失败（已降级为不返回几何）: {}", e.getMessage());
            return null;
        }
    }

    private Integer nearestWalkableNode(Double lng, Double lat) {
        Map<String, Object> node = navigationMapper.findNearestWalkableNode(lng, lat);
        return node == null ? null : ((Number) node.get("id")).intValue();
    }
}
