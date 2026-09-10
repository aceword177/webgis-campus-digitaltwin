package com.campus.twin.service;

import com.campus.twin.dto.DeliveryStatsVO;
import com.campus.twin.dto.OrderCreateRequest;
import com.campus.twin.dto.OrderDetailVO;
import com.campus.twin.entity.DeliveryOrder;

import java.util.List;

public interface OrderService {

    List<DeliveryOrder> list(String status, Integer page, Integer size);

    OrderDetailVO getDetail(Integer id);

    DeliveryOrder create(OrderCreateRequest request);

    /** 分配无人机（自动调度或指定无人机） */
    DeliveryOrder assignDrone(Integer orderId, Integer droneId);

    /** 确认送达 */
    DeliveryOrder confirmDeliver(Integer orderId);

    /** 取消订单 */
    DeliveryOrder cancel(Integer orderId, String reason);

    /** 配送统计 */
    DeliveryStatsVO getDeliveryStats();
}
