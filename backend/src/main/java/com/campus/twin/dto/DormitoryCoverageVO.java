package com.campus.twin.dto;

import lombok.Builder;
import lombok.Data;

import java.io.Serializable;

@Data
@Builder
public class DormitoryCoverageVO implements Serializable {
    private Integer id;
    private String name;
    private Double distanceM;
    private Integer seconds;
    private Double lng;
    private Double lat;
}
