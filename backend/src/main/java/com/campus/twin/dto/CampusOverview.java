package com.campus.twin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

/**
 * 校园概览统计 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CampusOverview implements Serializable {

    /** 建筑总数 */
    private Integer buildingCount;

    /** 建筑总面积（平方米） */
    private Double buildingArea;

    /** 平均楼层 */
    private Double avgFloors;

    /** 最高楼层 */
    private Integer maxFloors;

    /** 道路条数 */
    private Integer roadCount;

    /** 道路总长度（米） */
    private Double roadLength;

    /** 场地数量（操场+篮球场+网球场） */
    private Integer venueCount;

    /** 校园中心点经度 */
    private Double centerLng;

    /** 校园中心点纬度 */
    private Double centerLat;

    /** 校园占地面积（平方米） */
    private Double campusArea;
}
