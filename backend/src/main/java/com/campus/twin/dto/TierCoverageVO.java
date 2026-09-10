package com.campus.twin.dto;

import lombok.Builder;
import lombok.Data;

import java.io.Serializable;
import java.util.List;

@Data
@Builder
public class TierCoverageVO implements Serializable {
    private Integer seconds;
    private Double radius;
    private List<DormitoryCoverageVO> dormitories;
}
