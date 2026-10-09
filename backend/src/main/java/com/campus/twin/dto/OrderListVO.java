package com.campus.twin.dto;

import lombok.Builder;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 订单列表项 VO
 *
 * <p>为什么需要它：此前 {@code /api/order/list} 直接返回 {@code DeliveryOrder} 实体，
 * 而该实体只有 {@code restaurantId} / {@code dormitoryId}，没有名称字段。
 * 于是前端 {@code OrderPanel.vue} 的
 * {@code {{ order.restaurant_name || '餐厅' }}} 永远落到兜底文案，
 * 订单列表长期只显示"餐厅 → 宿舍楼"。
 * {@code docs/api.md} 也早就把 {@code restaurant_name} 写进了该接口的契约。
 *
 * <p>本 VO 把关联名称一并带出，名称由 {@code OrderServiceImpl} 批量预取后填充
 * （不再逐个订单查库）。
 */
@Data
@Builder
public class OrderListVO implements Serializable {

    private Integer id;

    private String orderNo;

    private Integer restaurantId;

    /** 餐厅名称（关联 restaurant.name） */
    private String restaurantName;

    private Integer dormitoryId;

    /** 收货宿舍楼名称（关联 dormitory.name） */
    private String dormitoryName;

    private String receiverName;

    private String receiverPhone;

    private String itemsText;

    private BigDecimal amount;

    private String status;

    /** 中文状态标签，避免前端重复维护映射表 */
    private String statusLabel;

    private Integer droneId;

    private LocalDateTime createTime;

    private LocalDateTime assignTime;

    private LocalDateTime deliverTime;

    private String remark;
}
