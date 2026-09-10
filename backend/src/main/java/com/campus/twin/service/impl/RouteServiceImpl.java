package com.campus.twin.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.campus.twin.dto.RoutePlanRequest;
import com.campus.twin.dto.RoutePlanResponse;
import com.campus.twin.entity.FlightRoute;
import com.campus.twin.mapper.FlightRouteMapper;
import com.campus.twin.mapper.NavigationMapper;
import com.campus.twin.service.RouteService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 航线服务实现
 * 核心算法：基于 pgrouting A* 的最短路径规划 + 限飞区自动避让
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RouteServiceImpl implements RouteService {

    private final NavigationMapper navigationMapper;
    private final FlightRouteMapper flightRouteMapper;
    private final ObjectMapper objectMapper;

    /** 无人机飞行速度(m/s)，默认5m/s ≈ 18km/h（与实时位置推进保持一致） */
    private static final double FLIGHT_SPEED = 5.0;

    @Override
    public RoutePlanResponse plan(RoutePlanRequest request) {
        log.info("开始规划航线: 起点({},{}) -> 终点({},{})",
                request.getStartLng(), request.getStartLat(),
                request.getEndLng(), request.getEndLat());

        // Step 1: 找起点最近的可飞行网格节点
        Map<String, Object> startNode = navigationMapper.findNearestWalkableNode(
                request.getStartLng(), request.getStartLat());
        if (startNode == null) {
            throw new RuntimeException("起点附近没有可飞行的网格节点");
        }
        Integer startNodeId = ((Number) startNode.get("id")).intValue();
        log.info("起点最近网格节点: {}", startNodeId);

        // Step 2: 找终点最近的可飞行网格节点
        Map<String, Object> endNode = navigationMapper.findNearestWalkableNode(
                request.getEndLng(), request.getEndLat());
        if (endNode == null) {
            throw new RuntimeException("终点附近没有可飞行的网格节点");
        }
        Integer endNodeId = ((Number) endNode.get("id")).intValue();
        log.info("终点最近网格节点: {}", endNodeId);

        // Step 3: 调用 pgr_astar 求最短路径
        List<Map<String, Object>> pathResult = navigationMapper.findShortestPath(startNodeId, endNodeId);
        if (pathResult == null || pathResult.isEmpty()) {
            throw new RuntimeException("A* 路径规划失败，未找到可达路径");
        }
        log.info("A* 路径节点数: {}", pathResult.size());

        // Step 4: 提取路径节点ID列表（按 path_seq 排序）
        List<Integer> nodeIds = pathResult.stream()
                .sorted((a, b) -> Integer.compare(
                        ((Number) a.get("path_seq")).intValue(),
                        ((Number) b.get("path_seq")).intValue()))
                .map(m -> ((Number) m.get("node")).intValue())
                .collect(Collectors.toList());

        // Step 5: 根据节点ID列表构建航线几何并计算距离
        String nodeIdsStr = "{" + nodeIds.stream().map(String::valueOf).collect(Collectors.joining(",")) + "}";
        Map<String, Object> routeData = navigationMapper.buildRouteFromNodes(nodeIdsStr);

        String routeGeojson = (String) routeData.get("route_geojson");
        Double distanceM = routeData.get("distance_m") != null
                ? ((Number) routeData.get("distance_m")).doubleValue() : 0.0;

        // Step 6: 计算途径点坐标（从 GeoJSON 中提取）
        List<double[]> waypoints = extractWaypointsFromGeojson(routeGeojson);

        // Step 7: 计算预计飞行时间
        Integer estimatedSeconds = (int) Math.ceil(distanceM / FLIGHT_SPEED);

        // Step 8: 真实穿越检测（直线 vs A* 规划路径）
        // 8.1 起终点直线是否穿越限飞区（返回穿越明细）
        List<Map<String, Object>> crossedZones = navigationMapper.checkLineCrossNoFlyZone(
                request.getStartLng(), request.getStartLat(),
                request.getEndLng(), request.getEndLat());
        boolean straightLineCrossZone = crossedZones != null && !crossedZones.isEmpty();

        // 8.2 A* 规划路径（途经的边）是否仍与限飞区相交
        // pgr_astar 返回结果中 edge=-1 表示起点无入边，需过滤
        List<Integer> edgeIds = pathResult.stream()
                .filter(m -> m.get("edge") != null && ((Number) m.get("edge")).intValue() > 0)
                .map(m -> ((Number) m.get("edge")).intValue())
                .distinct()
                .collect(Collectors.toList());
        boolean routeStillCrossZone = false;
        if (!edgeIds.isEmpty()) {
            List<Map<String, Object>> pathCrossZones = navigationMapper.checkPathCrossNoFlyZone(edgeIds);
            routeStillCrossZone = pathCrossZones != null && !pathCrossZones.isEmpty();
        }

        // 成功避让 = 直线穿越限飞区 && 规划路径不再穿越
        boolean avoidedNoFlyZone = straightLineCrossZone && !routeStillCrossZone;

        log.info("航线规划完成: 距离={}m, 预计时间={}s, 途径点={}, 直线穿越限飞区={}, 路径仍穿越={}, 成功避让={}",
                distanceM, estimatedSeconds, waypoints.size(),
                straightLineCrossZone, routeStillCrossZone, avoidedNoFlyZone);

        return RoutePlanResponse.builder()
                .routeGeojson(routeGeojson)
                .waypoints(waypoints)
                .waypointsCount(waypoints.size())
                .distanceM(distanceM)
                .estimatedSeconds(estimatedSeconds)
                .altitudeM(request.getAltitude())
                .startNodeId(startNodeId)
                .endNodeId(endNodeId)
                .avoidedNoFlyZone(avoidedNoFlyZone)
                .straightLineCrossZone(straightLineCrossZone)
                .routeStillCrossZone(routeStillCrossZone)
                .crossedZones(crossedZones)
                .build();
    }

    @Override
    public FlightRoute getById(Integer id) {
        return flightRouteMapper.selectByIdWithGeoJson(id);
    }

    @Override
    public FlightRoute getByOrderId(Integer orderId) {
        return flightRouteMapper.selectByOrderIdWithGeoJson(orderId);
    }

    @Override
    public List<FlightRoute> getActiveRoutes() {
        return flightRouteMapper.selectByStatusWithGeoJson("flying");
    }

    @Override
    @Transactional
    public FlightRoute saveRoute(Integer orderId, Integer droneId, RoutePlanResponse plan) {
        FlightRoute route = new FlightRoute();
        route.setOrderId(orderId);
        route.setDroneId(droneId);
        route.setStartLng(BigDecimal.valueOf(plan.getWaypoints().get(0)[0]));
        route.setStartLat(BigDecimal.valueOf(plan.getWaypoints().get(0)[1]));
        route.setEndLng(BigDecimal.valueOf(plan.getWaypoints().get(plan.getWaypoints().size() - 1)[0]));
        route.setEndLat(BigDecimal.valueOf(plan.getWaypoints().get(plan.getWaypoints().size() - 1)[1]));
        route.setRouteGeom(plan.getRouteGeojson());
        route.setWaypointsCount(plan.getWaypointsCount());
        route.setDistanceM(BigDecimal.valueOf(plan.getDistanceM()));
        route.setEstimatedSeconds(plan.getEstimatedSeconds());
        route.setAltitudeM(BigDecimal.valueOf(plan.getAltitudeM()));
        // 分配即视为"飞行中"：前端 getActiveRoutes 会按 flying 状态把航线显示在地图上，
        // 使配送中的无人机始终"在航线上"（确认送达时再改为 completed）
        route.setStatus("flying");
        route.setCreateTime(LocalDateTime.now());
        flightRouteMapper.insertWithGeoJson(route);
        log.info("航线已保存: id={}, orderId={}, distance={}m", route.getId(), orderId, plan.getDistanceM());
        return route;
    }

    /**
     * 从 LineString GeoJSON 中提取途径点坐标（用 Jackson 解析，替代脆弱的手工字符串截取）
     */
    @SuppressWarnings("unchecked")
    private List<double[]> extractWaypointsFromGeojson(String geojson) {
        List<double[]> waypoints = new ArrayList<>();
        if (geojson == null || geojson.isBlank()) {
            return waypoints;
        }
        try {
            Map<String, Object> geo = objectMapper.readValue(geojson, Map.class);
            List<List<Number>> coords = (List<List<Number>>) geo.get("coordinates");
            if (coords != null) {
                for (List<Number> c : coords) {
                    if (c != null && c.size() >= 2) {
                        waypoints.add(new double[]{c.get(0).doubleValue(), c.get(1).doubleValue()});
                    }
                }
            }
        } catch (Exception e) {
            log.warn("解析航线 GeoJSON 途径点失败: {}", e.getMessage());
        }
        return waypoints;
    }
}
