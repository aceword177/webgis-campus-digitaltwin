package com.campus.twin.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 无人机实体
 */
@Data
@TableName("drone")
public class Drone implements Serializable {

    @TableId(type = IdType.AUTO)
    private Integer id;

    private String droneNo;

    private String model;

    /** 最大载重(kg) */
    private BigDecimal maxPayloadKg;

    /** 最大航程(km) */
    private BigDecimal maxRangeKm;

    /** 当前电量(0-100) */
    private Integer batteryPct;

    /** 状态：idle(空闲)/delivering(配送中)/charging(充电)/maintenance(维护) */
    private String status;

    private BigDecimal currentLng;

    private BigDecimal currentLat;

    private LocalDateTime lastUpdateTime;

    private LocalDateTime createTime;
}
