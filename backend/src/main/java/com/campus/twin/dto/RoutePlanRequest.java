package com.campus.twin.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * 航线规划请求
 */
@Data
public class RoutePlanRequest implements Serializable {

    private Double startLng;

    private Double startLat;

    private Double endLng;

    private Double endLat;

    /** 飞行高度(米)，默认50 */
    private Double altitude = 50.0;
}
