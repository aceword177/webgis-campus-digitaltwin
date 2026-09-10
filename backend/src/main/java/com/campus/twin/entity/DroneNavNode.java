package com.campus.twin.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;

/**
 * 无人机导航网格节点实体（A*路径规划用）
 */
@Data
@TableName("drone_nav_node")
public class DroneNavNode implements Serializable {

    @TableId(type = IdType.AUTO)
    private Integer id;

    private Integer gridCol;

    private Integer gridRow;

    private BigDecimal lng;

    private BigDecimal lat;

    @TableField("geom")
    private String geom;

    private Boolean isWalkable;
}
