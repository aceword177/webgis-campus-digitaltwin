package com.campus.twin.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.campus.twin.entity.DeliveryOrder;
import com.campus.twin.entity.FlightRoute;
import com.campus.twin.mapper.DeliveryOrderMapper;
import com.campus.twin.mapper.FlightRouteMapper;
import com.campus.twin.service.OrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 自动确认送达调度：每 2 秒检查一次
 * 判定口径：无人机飞行时间 ≥ 航线预计时间（即已飞完全程、到达航线终点/收货点），
 * 视为"已到达收货点"；到达满 8 秒后自动确认送达（模拟用户收到通知后确认收货）。
 * 平台手动"确认送达"按钮仍保留（到达校验逻辑不变）。
 *
 * 独立于 DroneServiceImpl，避免 OrderService ↔ DroneService 循环依赖
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AutoConfirmScheduler {

    private final DeliveryOrderMapper orderMapper;
    private final FlightRouteMapper flightRouteMapper;
    private final OrderService orderService;

    /** 到达收货点后延迟该秒数自动确认送达（模拟用户确认收货） */
    private static final long AUTO_CONFIRM_DELAY_SECONDS = 8;

    /** 记录"已到达收货点"的订单及其到达时刻，用于延迟自动确认 */
    private final Map<Integer, LocalDateTime> arrivedAt = new ConcurrentHashMap<>();

    @Scheduled(fixedDelay = 2000)
    public void autoConfirmDeliver() {
        try {
            List<DeliveryOrder> orders = orderMapper.selectList(
                    new LambdaQueryWrapper<DeliveryOrder>().eq(DeliveryOrder::getStatus, "delivering"));

            // 1) 记录/更新各订单的到达状态（已飞完全程 = 已到达收货点）
            for (DeliveryOrder order : orders) {
                if (order.getAssignTime() == null) {
                    continue;
                }
                FlightRoute route = flightRouteMapper.selectByOrderIdWithGeoJson(order.getId());
                if (route == null || route.getEstimatedSeconds() == null) {
                    continue;
                }
                long elapsed = Duration.between(order.getAssignTime(), LocalDateTime.now()).getSeconds();
                if (elapsed >= route.getEstimatedSeconds()) {
                    if (!arrivedAt.containsKey(order.getId())) {
                        arrivedAt.put(order.getId(), LocalDateTime.now());
                        log.info("无人机已到达收货点，等待自动确认送达: orderId={}, 飞行{}s≥预计{}s",
                                order.getId(), elapsed, route.getEstimatedSeconds());
                    }
                } else {
                    arrivedAt.remove(order.getId());
                }
            }

            // 2) 到达满延迟秒数且订单仍为配送中 → 自动确认送达（模拟用户确认收货）
            Iterator<Map.Entry<Integer, LocalDateTime>> it = arrivedAt.entrySet().iterator();
            while (it.hasNext()) {
                Map.Entry<Integer, LocalDateTime> entry = it.next();
                DeliveryOrder order = orderMapper.selectById(entry.getKey());
                if (order == null || !"delivering".equals(order.getStatus())) {
                    // 订单已不存在或状态已变化（如已被手动确认），清理记录
                    it.remove();
                    continue;
                }
                if (Duration.between(entry.getValue(), LocalDateTime.now()).getSeconds() >= AUTO_CONFIRM_DELAY_SECONDS) {
                    it.remove();
                    try {
                        orderService.confirmDeliver(entry.getKey());
                        log.info("模拟用户确认收货：订单 {} 已送达", entry.getKey());
                    } catch (Exception e) {
                        log.warn("自动确认送达失败: orderId={}, {}", entry.getKey(), e.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            log.warn("自动确认送达任务异常: {}", e.getMessage());
        }
    }
}
