package com.campus.twin.dto;

import lombok.Builder;
import lombok.Data;

import java.io.Serializable;
import java.util.Map;

/**
 * 无人机统计 VO
 */
@Data
@Builder
public class DroneStatsVO implements Serializable {

    private Integer total;

    private Integer idle;

    private Integer delivering;

    private Integer charging;

    private Integer maintenance;

    /** 平均电量 */
    private Double avgBattery;

    /** 各状态数量 Map */
    private Map<String, Integer> byStatus;
}
