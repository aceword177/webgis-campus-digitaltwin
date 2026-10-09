package com.campus.twin.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.campus.twin.common.GeoJsonSupport;
import com.campus.twin.dto.*;
import com.campus.twin.entity.*;
import com.campus.twin.mapper.*;
import com.campus.twin.service.CanteenLocator;
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
    private final CanteenLocator canteenLocator;
    private final ObjectMapper objectMapper;

    private static final DateTimeFormatter ORDER_NO_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    /** 确认送达时，无人机与收货地点的判定距离阈值（米） */
    private static final double ARRIVE_THRESHOLD_M = 30.0;

    @Override
    public List<OrderListVO> list(String status, Integer page, Integer size) {
        LambdaQueryWrapper<DeliveryOrder> wrapper = new LambdaQueryWrapper<>();
        if (status != null && !status.isBlank()) {
            wrapper.eq(DeliveryOrder::getStatus, status);
        }
        wrapper.orderByDesc(DeliveryOrder::getCreateTime);

        List<DeliveryOrder> rows;
        if (page != null && size != null) {
            Page<DeliveryOrder> pageResult = new Page<>(page, size);
            rows = orderMapper.selectPage(pageResult, wrapper).getRecords();
        } else {
            rows = orderMapper.selectList(wrapper);
        }
        return toListVo(rows);
    }

    /**
     * 批量把订单实体映射为带关联名称的列表 VO。
     *
     * <p>用两次 selectBatchIds 预取餐厅与宿舍名称，避免在循环里逐条查库（N+1）。
     */
    private List<OrderListVO> toListVo(List<DeliveryOrder> rows) {
        if (rows == null || rows.isEmpty()) {
            return List.of();
        }

        Set<Integer> restaurantIds = rows.stream()
                .map(DeliveryOrder::getRestaurantId).filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Set<Integer> dormitoryIds = rows.stream()
                .map(DeliveryOrder::getDormitoryId).filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<Integer, String> restaurantNames = restaurantIds.isEmpty()
                ? Map.of()
                : restaurantMapper.selectBatchIds(restaurantIds).stream()
                        .filter(r -> r.getId() != null)
                        .collect(Collectors.toMap(Restaurant::getId, Restaurant::getName, (a, b) -> a));
        Map<Integer, String> dormitoryNames = dormitoryIds.isEmpty()
                ? Map.of()
                : dormitoryMapper.selectBatchIds(dormitoryIds).stream()
                        .filter(d -> d.getId() != null)
                        .collect(Collectors.toMap(Dormitory::getId, Dormitory::getName, (a, b) -> a));

        return rows.stream().map(o -> OrderListVO.builder()
                .id(o.getId())
                .orderNo(o.getOrderNo())
                .restaurantId(o.getRestaurantId())
                .restaurantName(o.getRestaurantId() != null
                        ? restaurantNames.getOrDefault(o.getRestaurantId(), "未知餐厅") : "未知餐厅")
                .dormitoryId(o.getDormitoryId())
                .dormitoryName(o.getDormitoryId() != null
                        ? dormitoryNames.getOrDefault(o.getDormitoryId(), "未知宿舍楼") : "未知宿舍楼")
                .receiverName(o.getReceiverName())
                .receiverPhone(o.getReceiverPhone())
                .itemsText(o.getItemsText())
                .amount(o.getAmount())
                .status(o.getStatus())
                .statusLabel(getStatusLabel(o.getStatus()))
                .droneId(o.getDroneId())
                .createTime(o.getCreateTime())
                .assignTime(o.getAssignTime())
                .deliverTime(o.getDeliverTime())
                .remark(o.getRemark())
                .build()).collect(Collectors.toList());
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

    /** 计算无人机应停靠的食堂充电/待命落点（最近食堂质心周边的确定性散点） */
    private double[] canteenSpotFor(Drone drone) {
        double lng = drone.getCurrentLng() != null ? drone.getCurrentLng().doubleValue() : 0.0;
        double lat = drone.getCurrentLat() != null ? drone.getCurrentLat().doubleValue() : 0.0;
        // 落点由 CanteenLocator 统一计算（同一无人机恒定落点，避免坐标反复抖动）
        return canteenLocator.parkingSpotFor(drone.getId(), lng, lat);
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
        // 聚合全部下推到 SQL：此前是 orderMapper.selectList(null) 把整张订单表读进内存再遍历。
        // 订单表只增不删，那种写法会随数据量线性劣化（现已 6000+ 行，且只会更多）。
        Map<String, Integer> statusCount = new LinkedHashMap<>();
        int todayOrders = 0;
        int todayDelivered = 0;
        int todayDelivering = 0;
        int todayPending = 0;

        for (Map<String, Object> row : orderMapper.selectStatusCounts()) {
            String status = (String) row.get("status");
            if (status == null) {
                continue;
            }
            int total = toInt(row.get("status_count"));
            int today = toInt(row.get("today_count"));

            statusCount.put(status, total);
            todayOrders += today;
            switch (status) {
                case "delivered" -> todayDelivered += today;
                case "delivering" -> todayDelivering += today;
                case "pending" -> todayPending += today;
                default -> { /* 其余状态不计入今日分项，但仍保留在 statusCount 中 */ }
            }
        }

        Double avgMinutes = orderMapper.selectAvgDeliveryMinutes();

        Map<String, Integer> ordersByRestaurant = new LinkedHashMap<>();
        for (Map<String, Object> row : orderMapper.selectOrderCountByRestaurant()) {
            Object name = row.get("restaurant_name");
            if (name != null) {
                ordersByRestaurant.put(String.valueOf(name), toInt(row.get("order_count")));
            }
        }

        return DeliveryStatsVO.builder()
                .todayOrders(todayOrders)
                .todayDelivered(todayDelivered)
                .todayDelivering(todayDelivering)
                .todayPending(todayPending)
                .deliveryRate(todayOrders > 0
                        ? Math.round(todayDelivered * 100.0 / todayOrders) / 100.0 : 0.0)
                .avgDeliveryMinutes(avgMinutes != null
                        ? Math.round(avgMinutes * 10.0) / 10.0 : 0.0)
                .orderStatusCount(statusCount)
                .ordersByRestaurant(ordersByRestaurant)
                .build();
    }

    /** 汇总行取值：COUNT/AVG 在不同驱动下可能返回 Integer/Long/BigDecimal，统一收敛 */
    private int toInt(Object v) {
        return v instanceof Number n ? n.intValue() : 0;
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
     * 从空间查询结果中提取质心坐标。
     *
     * <p>解析统一委托 {@link GeoJsonSupport#parseCentroid}，消除此前各服务各写一套
     * （`(String)` 强转 / `instanceof Map` / 手工 Jackson）的不一致写法。
     *
     * <p>本方法**保持"失败即抛业务异常"的语义**：派单必须拿到真实建筑坐标，
     * 静默兜底到校园外的默认坐标会让航线从错误位置起飞。
     */
    private double[] extractCentroid(Map<String, Object> spatialData) {
        double[] c = GeoJsonSupport.parseCentroid(spatialData, objectMapper);
        if (c != null) {
            return c;
        }
        throw new IllegalArgumentException("建筑空间坐标缺失，无法规划航线");
    }
}
