package com.campus.twin.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 飞行航线实体
 */
@Data
@TableName("flight_route")
public class FlightRoute implements Serializable {

    @TableId(type = IdType.AUTO)
    private Integer id;

    private Integer orderId;

    private Integer droneId;

    private BigDecimal startLng;

    private BigDecimal startLat;

    private BigDecimal endLng;

    private BigDecimal endLat;

    /** 航线几何 - GeoJSON 字符串（ST_AsGeoJSON 转换） */
    @TableField("route_geom")
    private String routeGeom;

    private Integer waypointsCount;

    private BigDecimal distanceM;

    private Integer estimatedSeconds;

    private BigDecimal altitudeM;

    /** 状态：planned(已规划)/flying(飞行中)/completed(已完成) */
    private String status;

    private LocalDateTime createTime;
}
