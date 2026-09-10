package com.campus.twin.dto;

import lombok.Builder;
import lombok.Data;

import java.io.Serializable;
import java.util.List;

@Data
@Builder
public class CanteenCoverageVO implements Serializable {
    private Integer canteenId;
    private String name;
    private Double centerLng;
    private Double centerLat;
    private List<TierCoverageVO> tiers;
}
