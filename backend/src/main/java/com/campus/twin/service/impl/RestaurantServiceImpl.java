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

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
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
            }
            all.sort(Comparator.comparingInt(DormitoryCoverageVO::getSeconds));
            List<TierCoverageVO> tiers = new ArrayList<>();
            for (int sec : new int[]{30, 60, 90}) {
                final int threshold = sec;
                tiers.add(TierCoverageVO.builder()
                        .seconds(sec)
                        .radius(sec * FLIGHT_SPEED)
                        .dormitories(all.stream()
                                .filter(d -> d.getSeconds() <= threshold)
                                .collect(Collectors.toList()))
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

    private Integer nearestWalkableNode(Double lng, Double lat) {
        Map<String, Object> node = navigationMapper.findNearestWalkableNode(lng, lat);
        return node == null ? null : ((Number) node.get("id")).intValue();
    }
}
