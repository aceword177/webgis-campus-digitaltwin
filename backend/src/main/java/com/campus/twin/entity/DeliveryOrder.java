package com.campus.twin.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 配送订单实体
 */
@Data
@TableName("delivery_order")
public class DeliveryOrder implements Serializable {

    @TableId(type = IdType.AUTO)
    private Integer id;

    private String orderNo;

    private Integer restaurantId;

    /** 关联 dormitory.id */
    private Integer dormitoryId;

    private String receiverName;

    private String receiverPhone;

    /** 商品明细文本 */
    private String itemsText;

    private BigDecimal amount;

    /** 状态：pending(待接单)/assigned(已分配)/delivering(配送中)/delivered(已送达)/cancelled(已取消) */
    private String status;

    private Integer droneId;

    private LocalDateTime createTime;

    private LocalDateTime assignTime;

    private LocalDateTime deliverTime;

    private String remark;
}
