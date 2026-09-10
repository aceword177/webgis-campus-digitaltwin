package com.campus.twin.dto;

import lombok.Builder;
import lombok.Data;

import java.io.Serializable;
import java.util.List;

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

    /** 是否避让了限飞区 */
    private Boolean avoidedNoFlyZone;
}
