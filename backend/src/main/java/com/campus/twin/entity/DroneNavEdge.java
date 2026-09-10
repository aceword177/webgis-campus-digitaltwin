package com.campus.twin.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;

/**
 * 无人机导航边实体（A*路径规划用）
 */
@Data
@TableName("drone_nav_edge")
public class DroneNavEdge implements Serializable {

    @TableId(type = IdType.AUTO)
    private Integer id;

    private Integer source;

    private Integer target;

    private BigDecimal cost;

    private BigDecimal reverseCost;

    private BigDecimal x1;

    private BigDecimal y1;

    private BigDecimal x2;

    private BigDecimal y2;

    @TableField("geom")
    private String geom;
}
