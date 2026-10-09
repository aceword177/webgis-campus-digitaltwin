package com.campus.twin.service;

import com.campus.twin.dto.DeliveryStatsVO;
import com.campus.twin.dto.OrderCreateRequest;
import com.campus.twin.dto.OrderDetailVO;
import com.campus.twin.dto.OrderListVO;
import com.campus.twin.entity.DeliveryOrder;

import java.util.List;

public interface OrderService {

    /**
     * 订单列表（含餐厅/宿舍楼名称）。
     * 返回 VO 而非实体：实体的 restaurantId/dormitoryId 无法满足前端展示与 api.md 契约。
     */
    List<OrderListVO> list(String status, Integer page, Integer size);

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
