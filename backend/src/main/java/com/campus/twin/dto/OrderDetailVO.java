package com.campus.twin.dto;

import lombok.Builder;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 订单详情 VO（含关联信息）
 */
@Data
@Builder
public class OrderDetailVO implements Serializable {

    private Integer id;

    private String orderNo;

    private Integer restaurantId;

    private String restaurantName;

    private Integer dormitoryId;

    private String dormitoryName;

    private String receiverName;

    private String receiverPhone;

    private String itemsText;

    private BigDecimal amount;

    private String status;

    private String statusLabel;

    private Integer droneId;

    private String droneNo;

    private LocalDateTime createTime;

    private LocalDateTime assignTime;

    private LocalDateTime deliverTime;

    private String remark;

    /** 关联航线信息 */
    private RouteInfo route;

    @Data
    @Builder
    public static class RouteInfo implements Serializable {
        private Integer routeId;
        private String routeGeojson;
        private Double distanceM;
        private Integer estimatedSeconds;
        private Double altitudeM;
        private String status;
    }
}
