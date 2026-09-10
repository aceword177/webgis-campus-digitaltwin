package com.campus.twin.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.campus.twin.entity.DeliveryOrder;
import com.campus.twin.entity.Dormitory;
import com.campus.twin.entity.Drone;
import com.campus.twin.entity.Restaurant;
import com.campus.twin.mapper.DeliveryOrderMapper;
import com.campus.twin.mapper.DormitoryMapper;
import com.campus.twin.mapper.DroneMapper;
import com.campus.twin.mapper.RestaurantMapper;
import com.campus.twin.service.OrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Random;

/**
 * 自动补单调度：每 30 秒检查一次
 * 对"空闲且电量充足(>30%)、且无进行中订单"的无人机自动生成随机订单并分配，
 * 使无人机配送演示持续运转（空闲→接单→飞行→送达→充电→再接单）
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AutoOrderScheduler {

    private final DroneMapper droneMapper;
    private final DeliveryOrderMapper orderMapper;
    private final RestaurantMapper restaurantMapper;
    private final DormitoryMapper dormitoryMapper;
    private final OrderService orderService;

    /** 全局自动订单上限（待处理 + 配送中订单总数），10 架无人机下允许更多并发在飞 */
    private static final int MAX_AUTO_ORDERS = 8;

    /** 电量充足门槛：电量 > 30% 视为可派单（与业务口径一致：≤30% 为电量不足） */
    private static final int MIN_BATTERY = 30;

    private static final DateTimeFormatter ORDER_NO_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private static final String[] SURNAMES = {"王", "李", "张", "刘", "陈", "杨", "赵", "黄", "周", "吴"};
    private static final String[] GIVEN_NAMES = {"伟", "芳", "娜", "敏", "静", "磊", "军", "洋", "勇", "艳", "杰", "娟", "涛", "明", "超", "秀英", "霞", "平", "刚", "桂英"};
    private static final String[] ITEMS = {
            "黄焖鸡米饭×1、冰可乐×1",
            "麻辣香锅×1、米饭×2",
            "兰州拉面×2、茶叶蛋×2",
            "鱼香肉丝盖饭×1、紫菜蛋花汤×1",
            "炸鸡汉堡×2、薯条×1",
            "西红柿鸡蛋面×1、卤蛋×1",
            "宫保鸡丁饭×1、柠檬水×1",
            "牛肉粉丝汤×1、烧饼×2"
    };

    private static final Random RANDOM = new Random();

    @Scheduled(fixedDelay = 30000)
    public void autoGenerateOrders() {
        try {
            // 全局上限控制：待处理 + 配送中订单数达到上限则不再生成
            long active = orderMapper.selectCount(new LambdaQueryWrapper<DeliveryOrder>()
                    .in(DeliveryOrder::getStatus, "pending", "assigned", "delivering"));
            if (active >= MAX_AUTO_ORDERS) {
                return;
            }

            // 空闲且电量充足的无人机
            List<Drone> idleDrones = droneMapper.selectList(new LambdaQueryWrapper<Drone>()
                    .eq(Drone::getStatus, "idle")
                    .gt(Drone::getBatteryPct, MIN_BATTERY));
            if (idleDrones.isEmpty()) {
                return;
            }

            List<Restaurant> restaurants = restaurantMapper.selectList(null);
            List<Dormitory> dormitories = dormitoryMapper.selectList(null);
            if (restaurants.isEmpty() || dormitories.isEmpty()) {
                return;
            }

            for (Drone drone : idleDrones) {
                if (active >= MAX_AUTO_ORDERS) {
                    break;
                }
                // 该无人机已有进行中订单则不重复生成
                long droneActive = orderMapper.selectCount(new LambdaQueryWrapper<DeliveryOrder>()
                        .eq(DeliveryOrder::getDroneId, drone.getId())
                        .in(DeliveryOrder::getStatus, "pending", "assigned", "delivering"));
                if (droneActive > 0) {
                    continue;
                }

                DeliveryOrder order = new DeliveryOrder();
                order.setOrderNo("DD" + LocalDateTime.now().format(ORDER_NO_FORMAT) + RANDOM.nextInt(1000));
                Restaurant restaurant = restaurants.get(RANDOM.nextInt(restaurants.size()));
                Dormitory dormitory = dormitories.get(RANDOM.nextInt(dormitories.size()));
                order.setRestaurantId(restaurant.getId());
                order.setDormitoryId(dormitory.getId());
                order.setReceiverName(SURNAMES[RANDOM.nextInt(SURNAMES.length)] + GIVEN_NAMES[RANDOM.nextInt(GIVEN_NAMES.length)]);
                order.setReceiverPhone("138" + String.format("%08d", RANDOM.nextInt(100000000)));
                order.setItemsText(ITEMS[RANDOM.nextInt(ITEMS.length)]);
                order.setAmount(BigDecimal.valueOf(15 + RANDOM.nextInt(26) + RANDOM.nextDouble())
                        .setScale(2, RoundingMode.HALF_UP));
                order.setStatus("pending");
                order.setCreateTime(LocalDateTime.now());
                orderMapper.insert(order);

                // 自动分配
                try {
                    orderService.assignDrone(order.getId(), drone.getId());
                    log.info("自动生成订单并分配: orderNo={}, 无人机={}, 餐厅={}, 宿舍楼={}, 金额={}元",
                            order.getOrderNo(), drone.getDroneNo(), restaurant.getName(),
                            dormitory.getName(), order.getAmount());
                    active++;
                } catch (Exception e) {
                    log.warn("自动订单分配失败，取消订单: orderNo={}, {}", order.getOrderNo(), e.getMessage());
                    order.setStatus("cancelled");
                    order.setRemark("自动分配失败");
                    orderMapper.updateById(order);
                }
            }
        } catch (Exception e) {
            log.warn("自动生成订单任务异常: {}", e.getMessage());
        }
    }
}
