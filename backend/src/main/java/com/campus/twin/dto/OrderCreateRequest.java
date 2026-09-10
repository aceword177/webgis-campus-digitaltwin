package com.campus.twin.dto;

import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;

/**
 * 创建订单请求
 */
@Data
public class OrderCreateRequest implements Serializable {

    private Integer restaurantId;

    private Integer dormitoryId;

    private String receiverName;

    private String receiverPhone;

    /** 商品明细文本 */
    private String itemsText;

    private BigDecimal amount;

    private String remark;
}
