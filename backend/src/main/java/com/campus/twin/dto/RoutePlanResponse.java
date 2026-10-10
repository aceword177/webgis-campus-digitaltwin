package com.campus.twin.dto;

import lombok.Builder;
import lombok.Data;

import java.io.Serializable;
import java.util.List;
import java.util.Map;

/**
 * 航线规划响应
 */
@Data
@Builder
public class RoutePlanResponse implements Serializable {

    /** 航线 GeoJSON */
    private String routeGeojson;

    /** 途径点坐标列表 [[lng,lat], ...] */
    private List<double[]> waypoints;

    /** 途径点数量 */
    private Integer waypointsCount;

    /** 航线总距离(米) */
    private Double distanceM;

    /** 预计飞行时间(秒) */
    private Integer estimatedSeconds;

    /** 飞行高度(米) */
    private Double altitudeM;

    /** 起点最近网格节点ID */
    private Integer startNodeId;

    /** 终点最近网格节点ID */
    private Integer endNodeId;

    /** 是否避让了限飞区（直线穿越 && 规划路径不再穿越 = true） */
    private Boolean avoidedNoFlyZone;

    /** 起终点直线是否穿越限飞区 */
    private Boolean straightLineCrossZone;

    /** A* 规划路径是否仍与限飞区相交（true = 避让不彻底的警告） */
    private Boolean routeStillCrossZone;

    /** 直线穿越的限飞区明细（id/name/level） */
    private List<Map<String, Object>> crossedZones;

    /**
     * 起终点直线距离（米，球面口径，与 distanceM 同基准）。
     * 用于对比「直线 vs 规划路径」，量化 A* 为避让限飞区多飞的距离。
     */
    private Double straightDistanceM;

    /** 绕行增量（米）= distanceM - straightDistanceM */
    private Double detourM;

    /** 绕行比例（绕行增量 / 直线距离）；直线距离小于 1m 时为 null（比值无意义） */
    private Double detourRatio;
}
