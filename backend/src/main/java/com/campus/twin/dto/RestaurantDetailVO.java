package com.campus.twin.dto;

import lombok.Builder;
import lombok.Data;

import java.io.Serializable;

/**
 * 餐厅详情 VO（含建筑坐标信息）
 */
@Data
@Builder
public class RestaurantDetailVO implements Serializable {

    private Integer id;

    private Integer buildingId;

    private String name;

    private Integer windowCount;

    private String openTime;

    private Double rating;

    private String phone;

    /** 建筑质心经度 */
    private Double centerLng;

    /** 建筑质心纬度 */
    private Double centerLat;

    /** 建筑 GeoJSON */
    private String buildingGeojson;
}
