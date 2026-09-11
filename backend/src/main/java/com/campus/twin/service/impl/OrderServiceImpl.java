package com.campus.twin.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.campus.twin.dto.*;
import com.campus.twin.entity.*;
import com.campus.twin.mapper.*;
import com.campus.twin.service.OrderService;
import com.campus.twin.service.RouteService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {

    private final DeliveryOrderMapper orderMapper;
    private final RestaurantMapper restaurantMapper;
    private final DormitoryMapper dormitoryMapper;
    private final DroneMapper droneMapper;
    private final FlightRouteMapper flightRouteMapper;
    private final SpatialQueryMapper spatialQueryMapper;
    private final RouteService routeService;
    private final ObjectMapper objectMapper;

    private static final DateTimeFormatter ORDER_NO_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    /** 确认送达时，无人机与收货地点的判定距离阈值（米） */
    private static final double ARRIVE_THRESHOLD_M = 30.0;

    /** 充电落点散布半径（米）：无人机在食堂周边随机散布，避免重叠在食堂中心 */
    private static final double CHARGE_SPREAD_M = 5.0;

    private static final Random RANDOM = new Random();

    @Override
    public List<DeliveryOrder> list(String status, Integer page, Integer size) {
        LambdaQueryWrapper<DeliveryOrder> wrapper = new LambdaQueryWrapper<>();
        if (status != null && !status.isBlank()) {
            wrapper.eq(DeliveryOrder::getStatus, status);
        }
        wrapper.orderByDesc(DeliveryOrder::getCreateTime);
        if (page != null && size != null) {
            Page<DeliveryOrder> pageResult = new Page<>(page, size);
            return orderMapper.selectPage(pageResult, wrapper).getRecords();
        }
        return orderMapper.selectList(wrapper);
    }

    @Override
    public OrderDetailVO getDetail(Integer id) {
        DeliveryOrder order = orderMapper.selectById(id);
        if (order == null) {
            return null;
        }
        return buildOrderDetail(order);
    }

    @Override
    @Transactional
    public DeliveryOrder create(OrderCreateRequest request) {
        // 校验餐厅
        Restaurant restaurant = restaurantMapper.selectById(request.getRestaurantId());
        if (restaurant == null) {
            throw new IllegalArgumentException("餐厅不存在: " + request.getRestaurantId());
        }
        // 校验宿舍楼
        Dormitory dormitory = dormitoryMapper.selectById(request.getDormitoryId());
        if (dormitory == null) {
            throw new IllegalArgumentException("宿舍楼不存在: " + request.getDormitoryId());
        }

        DeliveryOrder order = new DeliveryOrder();
        order.setOrderNo("DD" + LocalDateTime.now().format(ORDER_NO_FORMAT)
                + UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase());
        order.setRestaurantId(request.getRestaurantId());
        order.setDormitoryId(request.getDormitoryId());
        order.setReceiverName(request.getReceiverName() != null ? request.getReceiverName() : "匿名用户");
        order.setReceiverPhone(request.getReceiverPhone() != null ? request.getReceiverPhone() : "138****0000");
        order.setItemsText(request.getItemsText() != null ? request.getItemsText() : "餐品若干");
        order.setAmount(request.getAmount() != null ? request.getAmount() : BigDecimal.ZERO);
        order.setStatus("pending");
        order.setCreateTime(LocalDateTime.now());
        order.setRemark(request.getRemark());
        orderMapper.insert(order);

        log.info("订单创建成功: orderNo={}, 餐厅={}, 宿舍楼={}", order.getOrderNo(), restaurant.getName(), dormitory.getName());
        return order;
    }

    @Override
    @Transactional
    public DeliveryOrder assignDrone(Integer orderId, Integer droneId) {
        // 行级加锁：锁定订单行直至事务提交，防止自动补单/自动续派/手动分配并发下重复派单
        DeliveryOrder order = orderMapper.selectByIdForUpdate(orderId);
        if (order == null) {
            throw new IllegalArgumentException("订单不存在: " + orderId);
        }
        if (!"pending".equals(order.getStatus()) && !"assigned".equals(order.getStatus())) {
            throw new IllegalStateException("订单状态不允许分配无人机: " + order.getStatus());
        }

        // 自动调度或指定无人机（均走 FOR UPDATE 加锁查询，锁持有至事务提交）
        Drone drone;
        if (droneId != null) {
            drone = droneMapper.selectIdleByIdForUpdate(droneId);
            if (drone == null) {
                throw new IllegalStateException("无人机不存在或不空闲: " + droneId);
            }
        } else {
            drone = droneMapper.selectAvailableForUpdate();
            if (drone == null) {
                throw new IllegalStateException("没有可用的空闲无人机");
            }
        }

        // 获取餐厅坐标（质心）
        Restaurant restaurant = restaurantMapper.selectById(order.getRestaurantId());
        Map<String, Object> restaurantBuilding = spatialQueryMapper.selectById("other_buildings", restaurant.getBuildingId());
        double[] restaurantCoord = extractCentroid(restaurantBuilding);

        // 获取宿舍楼坐标（质心）
        Map<String, Object> dormitoryBuilding = spatialQueryMapper.selectById("dormitory", order.getDormitoryId());
        double[] dormitoryCoord = extractCentroid(dormitoryBuilding);

        // 规划航线（pgr_astar）
        RoutePlanRequest routeRequest = new RoutePlanRequest();
        routeRequest.setStartLng(restaurantCoord[0]);
        routeRequest.setStartLat(restaurantCoord[1]);
        routeRequest.setEndLng(dormitoryCoord[0]);
        routeRequest.setEndLat(dormitoryCoord[1]);
        // 飞行高度 = 起终点建筑中较高者 + 30m 安全余量（更直观贴合建筑）
        double altitude = Math.max(
                toHeightMeters(restaurantBuilding.get("height")),
                toHeightMeters(dormitoryBuilding.get("height"))) + 30.0;
        routeRequest.setAltitude(altitude);
        log.info("订单 {} 飞行高度: {}m (餐厅建筑={}m, 宿舍楼={}m)",
                orderId, String.format("%.1f", altitude),
                String.format("%.1f", toHeightMeters(restaurantBuilding.get("height"))),
                String.format("%.1f", toHeightMeters(dormitoryBuilding.get("height"))));
        RoutePlanResponse plan = routeService.plan(routeRequest);

        // 保存航线
        routeService.saveRoute(orderId, drone.getId(), plan);

        // 更新订单状态
        order.setDroneId(drone.getId());
        order.setStatus("delivering");
        order.setAssignTime(LocalDateTime.now());
        orderMapper.updateById(order);

        // 更新无人机状态
        drone.setStatus("delivering");
        drone.setCurrentLng(BigDecimal.valueOf(restaurantCoord[0]));
        drone.setCurrentLat(BigDecimal.valueOf(restaurantCoord[1]));
        drone.setLastUpdateTime(LocalDateTime.now());
        droneMapper.updateById(drone);

        log.info("订单分配无人机成功: orderId={}, drone={}, 航线距离={}m, 预计{}s",
                orderId, drone.getDroneNo(), plan.getDistanceM(), plan.getEstimatedSeconds());
        return order;
    }

    @Override
    @Transactional
    public DeliveryOrder confirmDeliver(Integer orderId) {
        DeliveryOrder order = orderMapper.selectById(orderId);
        if (order == null) {
            throw new IllegalArgumentException("订单不存在: " + orderId);
        }
        if (!"delivering".equals(order.getStatus())) {
            throw new IllegalStateException("订单状态不允许确认送达: " + order.getStatus());
        }

        // ===== 校验无人机是否已到达收货地点 =====
        Drone drone = order.getDroneId() != null ? droneMapper.selectById(order.getDroneId()) : null;
        if (drone == null || drone.getCurrentLng() == null || drone.getCurrentLat() == null) {
            throw new IllegalArgumentException("无人机位置未知，无法确认送达");
        }
        Double distance = spatialQueryMapper.selectDistanceToFeature(
                "dormitory", order.getDormitoryId(),
                drone.getCurrentLng().doubleValue(), drone.getCurrentLat().doubleValue());
        if (distance == null) {
            throw new IllegalArgumentException("未找到收货宿舍楼，无法确认送达");
        }
        if (distance > ARRIVE_THRESHOLD_M) {
            log.info("确认送达被拒绝: 无人机 {} 距收货点 {} 米", drone.getDroneNo(), String.format("%.1f", distance));
            throw new IllegalArgumentException(String.format(
                    "无人机未到达收货地点(当前距离 %.1f 米)，无法确认送达", distance));
        }
        log.info("无人机 {} 已到达收货地点，确认送达", drone.getDroneNo());

        // ===== 到达校验通过，执行送达 =====
        order.setStatus("delivered");
        order.setDeliverTime(LocalDateTime.now());
        orderMapper.updateById(order);

        // 更新航线状态为已完成（只更新 status 字段，避免 route_geom 的 GeoJSON 字符串回写 geometry 列报错）
        FlightRoute route = routeService.getByOrderId(orderId);
        if (route != null) {
            LambdaUpdateWrapper<FlightRoute> routeWrapper = new LambdaUpdateWrapper<>();
            routeWrapper.eq(FlightRoute::getId, route.getId())
                    .set(FlightRoute::getStatus, "completed");
            flightRouteMapper.update(null, routeWrapper);
            log.info("航线状态更新为完成: routeId={}", route.getId());
        }

        // ===== 无人机：继续派送下一单，或返回食堂充电 =====
        if (drone != null) {
            // 模拟电量消耗（每次配送消耗5-15%）
            int consumed = 5 + (int) (Math.random() * 10);
            drone.setBatteryPct(Math.max(0, drone.getBatteryPct() - consumed));
            drone.setLastUpdateTime(LocalDateTime.now());
            log.info("无人机 {} 完成配送，剩余电量 {}%", drone.getDroneNo(), drone.getBatteryPct());

            // 尝试自动派送下一单（取最早创建的待接单）
            LambdaQueryWrapper<DeliveryOrder> nextWrapper = new LambdaQueryWrapper<>();
            nextWrapper.eq(DeliveryOrder::getStatus, "pending")
                    .orderByAsc(DeliveryOrder::getCreateTime)
                    .last("LIMIT 1");
            DeliveryOrder nextOrder = orderMapper.selectOne(nextWrapper);

            if (nextOrder != null && drone.getBatteryPct() > 30) {
                drone.setStatus("idle");
                droneMapper.updateById(drone);
                log.info("无人机 {} 准备派送下一单: orderId={}", drone.getDroneNo(), nextOrder.getId());
                try {
                    assignDrone(nextOrder.getId(), drone.getId());
                } catch (Exception e) {
                    log.warn("自动派送下一单失败，无人机返回充电: {}", e.getMessage());
                    goCharge(drone);
                }
            } else if (drone.getBatteryPct() > 30) {
                // 无待接单但电量充足 → 回食堂 idle 待命（不充电），等待自动补单立即起飞，缩短空档
                goBackToCanteenIdle(drone);
            } else {
                // 电量不足(≤30%) → 回食堂充电
                goCharge(drone);
            }
        }

        log.info("订单确认送达: orderId={}", orderId);
        return order;
    }

    /** 无人机返回最近的食堂充电点充电 */
    private void goCharge(Drone drone) {
        double[] spot = canteenSpotFor(drone);
        drone.setStatus("charging");
        drone.setCurrentLng(BigDecimal.valueOf(spot[0]));
        drone.setCurrentLat(BigDecimal.valueOf(spot[1]));
        drone.setLastUpdateTime(LocalDateTime.now());
        droneMapper.updateById(drone);
        log.info("无人机 {} 返回食堂充电，位置({}, {})，当前电量 {}%",
                drone.getDroneNo(), spot[0], spot[1], drone.getBatteryPct());
    }

    /** 无人机电量充足但暂无待接单时，回食堂 idle 待命（不充电），等待自动补单直接起飞 */
    private void goBackToCanteenIdle(Drone drone) {
        double[] spot = canteenSpotFor(drone);
        drone.setStatus("idle");
        drone.setCurrentLng(BigDecimal.valueOf(spot[0]));
        drone.setCurrentLat(BigDecimal.valueOf(spot[1]));
        drone.setLastUpdateTime(LocalDateTime.now());
        droneMapper.updateById(drone);
        log.info("无人机 {} 回食堂待命(电量 {}%)，等待自动补单，位置({}, {})",
                drone.getDroneNo(), drone.getBatteryPct(), spot[0], spot[1]);
    }

    /** 计算无人机应停靠的食堂充电/待命落点（最近食堂质心周边随机散布 5m） */
    private double[] canteenSpotFor(Drone drone) {
        double lng = drone.getCurrentLng() != null ? drone.getCurrentLng().doubleValue() : 0.0;
        double lat = drone.getCurrentLat() != null ? drone.getCurrentLat().doubleValue() : 0.0;
        double[] canteen = findNearestCanteen(lng, lat);
        // 充电/待命落点在食堂周边随机散布（5米内），避免所有无人机重叠在食堂中心
        return randomSpreadAround(canteen[0], canteen[1]);
    }

    /** 在指定点周边 CHARGE_SPREAD_M 米内随机散布（用于充电落点） */
    private double[] randomSpreadAround(double lng, double lat) {
        double angle = RANDOM.nextDouble() * 2 * Math.PI;
        double dist = RANDOM.nextDouble() * CHARGE_SPREAD_M;
        double dLat = dist * Math.cos(angle) / 111320.0;
        double dLng = dist * Math.sin(angle) / (111320.0 * Math.cos(Math.toRadians(lat)));
        return new double[]{lng + dLng, lat + dLat};
    }

    /** 找离无人机最近的食堂（餐厅所在建筑的质心） */
    private double[] findNearestCanteen(double lng, double lat) {
        List<Restaurant> restaurants = restaurantMapper.selectList(null);
        double[] best = null;
        double bestDist = Double.MAX_VALUE;
        for (Restaurant r : restaurants) {
            try {
                Map<String, Object> building = spatialQueryMapper.selectById("other_buildings", r.getBuildingId());
                double[] c = extractCentroid(building);
                double d = haversineDistance(lng, lat, c[0], c[1]);
                if (d < bestDist) {
                    bestDist = d;
                    best = c;
                }
            } catch (Exception e) {
                log.warn("获取食堂 {} 坐标失败: {}", r.getName(), e.getMessage());
            }
        }
        // 兜底：食堂1附近坐标
        return best != null ? best : new double[]{114.470404, 37.983182};
    }

    /** 简易经纬度距离计算（米） */
    private double haversineDistance(double lng1, double lat1, double lng2, double lat2) {
        double R = 6371000;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /** 建筑高度字段(层数)转米（每层 3.5m），字段为空或非法时兜底 6 层=21m */
    private double toHeightMeters(Object height) {
        try {
            if (height != null) {
                double floors = Double.parseDouble(String.valueOf(height));
                if (floors > 0) {
                    return floors * 3.5;
                }
            }
        } catch (Exception e) {
            log.warn("建筑高度解析失败，使用兜底值: {}", height);
        }
        return 21.0;
    }

    @Override
    @Transactional
    public DeliveryOrder cancel(Integer orderId, String reason) {
        DeliveryOrder order = orderMapper.selectById(orderId);
        if (order == null) {
            throw new IllegalArgumentException("订单不存在: " + orderId);
        }
        if ("delivered".equals(order.getStatus()) || "cancelled".equals(order.getStatus())) {
            throw new IllegalStateException("订单状态不允许取消: " + order.getStatus());
        }

        // 释放无人机
        if (order.getDroneId() != null) {
            Drone drone = droneMapper.selectById(order.getDroneId());
            if (drone != null && "delivering".equals(drone.getStatus())) {
                drone.setStatus("idle");
                drone.setLastUpdateTime(LocalDateTime.now());
                droneMapper.updateById(drone);
            }
        }

        order.setStatus("cancelled");
        order.setRemark(reason != null ? reason : "用户取消");
        orderMapper.updateById(order);

        log.info("订单取消: orderId={}, reason={}", orderId, reason);
        return order;
    }

    @Override
    public DeliveryStatsVO getDeliveryStats() {
        List<DeliveryOrder> all = orderMapper.selectList(null);
        LocalDateTime todayStart = LocalDateTime.now().toLocalDate().atStartOfDay();

        Map<String, Integer> statusCount = new HashMap<>();
        int todayOrders = 0;
        int todayDelivered = 0;
        int todayDelivering = 0;
        int todayPending = 0;
        double totalDeliveryMinutes = 0;
        int deliveredCount = 0;

        Map<String, Integer> ordersByRestaurant = new HashMap<>();

        // 批量预取餐厅信息，避免循环内 N+1 查询
        Set<Integer> restaurantIds = all.stream()
                .map(DeliveryOrder::getRestaurantId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Integer, Restaurant> restaurantMap = restaurantIds.isEmpty() ? Collections.emptyMap()
                : restaurantMapper.selectBatchIds(restaurantIds).stream()
                        .collect(Collectors.toMap(Restaurant::getId, r -> r));

        for (DeliveryOrder o : all) {
            statusCount.merge(o.getStatus(), 1, Integer::sum);

            boolean isToday = o.getCreateTime() != null && !o.getCreateTime().isBefore(todayStart);
            if (isToday) {
                todayOrders++;
                switch (o.getStatus()) {
                    case "delivered" -> todayDelivered++;
                    case "delivering" -> todayDelivering++;
                    case "pending" -> todayPending++;
                }
            }

            if ("delivered".equals(o.getStatus()) && o.getCreateTime() != null && o.getDeliverTime() != null) {
                double minutes = java.time.Duration.between(o.getCreateTime(), o.getDeliverTime()).toMillis() / 60000.0;
                totalDeliveryMinutes += minutes;
                deliveredCount++;
            }

            Restaurant r = restaurantMap.get(o.getRestaurantId());
            if (r != null) {
                ordersByRestaurant.merge(r.getName(), 1, Integer::sum);
            }
        }

        return DeliveryStatsVO.builder()
                .todayOrders(todayOrders)
                .todayDelivered(todayDelivered)
                .todayDelivering(todayDelivering)
                .todayPending(todayPending)
                .deliveryRate(todayOrders > 0 ? Math.round(todayDelivered * 100.0 / todayOrders) / 100.0 : 0.0)
                .avgDeliveryMinutes(deliveredCount > 0 ? Math.round(totalDeliveryMinutes / deliveredCount * 10.0) / 10.0 : 0.0)
                .orderStatusCount(statusCount)
                .ordersByRestaurant(ordersByRestaurant)
                .build();
    }

    /**
     * 构建订单详情 VO（含关联信息）
     */
    private OrderDetailVO buildOrderDetail(DeliveryOrder order) {
        Restaurant restaurant = restaurantMapper.selectById(order.getRestaurantId());
        Dormitory dormitory = dormitoryMapper.selectById(order.getDormitoryId());
        Drone drone = order.getDroneId() != null ? droneMapper.selectById(order.getDroneId()) : null;
        FlightRoute route = routeService.getByOrderId(order.getId());

        OrderDetailVO.OrderDetailVOBuilder builder = OrderDetailVO.builder()
                .id(order.getId())
                .orderNo(order.getOrderNo())
                .restaurantId(order.getRestaurantId())
                .restaurantName(restaurant != null ? restaurant.getName() : "未知餐厅")
                .dormitoryId(order.getDormitoryId())
                .dormitoryName(dormitory != null ? dormitory.getName() : "未知宿舍楼")
                .receiverName(order.getReceiverName())
                .receiverPhone(order.getReceiverPhone())
                .itemsText(order.getItemsText())
                .amount(order.getAmount())
                .status(order.getStatus())
                .statusLabel(getStatusLabel(order.getStatus()))
                .droneId(order.getDroneId())
                .droneNo(drone != null ? drone.getDroneNo() : null)
                .createTime(order.getCreateTime())
                .assignTime(order.getAssignTime())
                .deliverTime(order.getDeliverTime())
                .remark(order.getRemark());

        if (route != null) {
            builder.route(OrderDetailVO.RouteInfo.builder()
                    .routeId(route.getId())
                    .routeGeojson(route.getRouteGeom())
                    .distanceM(route.getDistanceM() != null ? route.getDistanceM().doubleValue() : null)
                    .estimatedSeconds(route.getEstimatedSeconds())
                    .altitudeM(route.getAltitudeM() != null ? route.getAltitudeM().doubleValue() : null)
                    .status(route.getStatus())
                    .build());
        }

        return builder.build();
    }

    private String getStatusLabel(String status) {
        return switch (status) {
            case "pending" -> "待接单";
            case "assigned" -> "已分配";
            case "delivering" -> "配送中";
            case "delivered" -> "已送达";
            case "cancelled" -> "已取消";
            default -> status;
        };
    }

    /**
     * 从空间查询结果中提取质心坐标
     * 注意：SQL 中 ST_AsGeoJSON(ST_Centroid(geom)) 返回的是 JSON 字符串，不是 Map，需安全解析
     * 解析失败时抛业务异常，禁止静默兜底到远离校园的默认坐标（否则航线会从错误位置起飞）
     */
    private double[] extractCentroid(Map<String, Object> spatialData) {
        if (spatialData != null && spatialData.get("centroid") != null) {
            try {
                Object centroidObj = spatialData.get("centroid");
                Map<String, Object> centroid;
                if (centroidObj instanceof Map) {
                    centroid = (Map<String, Object>) centroidObj;
                } else {
                    centroid = objectMapper.readValue(centroidObj.toString(), Map.class);
                }
                List<Double> coords = (List<Double>) centroid.get("coordinates");
                if (coords != null && coords.size() >= 2) {
                    return new double[]{coords.get(0), coords.get(1)};
                }
            } catch (Exception e) {
                log.warn("解析质心坐标失败: {}", e.getMessage());
            }
        }
        throw new IllegalArgumentException("建筑空间坐标缺失，无法规划航线");
    }
}
