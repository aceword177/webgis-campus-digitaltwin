package com.campus.twin.dto;

import lombok.Builder;
import lombok.Data;

import java.io.Serializable;
import java.util.Map;

/**
 * 配送统计 VO
 */
@Data
@Builder
public class DeliveryStatsVO implements Serializable {

    /** 今日订单总数 */
    private Integer todayOrders;

    /** 今日已送达 */
    private Integer todayDelivered;

    /** 今日配送中 */
    private Integer todayDelivering;

    /** 今日待接单 */
    private Integer todayPending;

    /** 配送完成率 */
    private Double deliveryRate;

    /** 平均配送时长(分钟) */
    private Double avgDeliveryMinutes;

    /** 各状态订单数量 */
    private Map<String, Integer> orderStatusCount;

    /** 各餐厅订单量 */
    private Map<String, Integer> ordersByRestaurant;
}
