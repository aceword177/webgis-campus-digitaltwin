package com.campus.twin.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 教学楼
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("teaching_building")
public class TeachingBuilding extends BaseAreaEntity implements BuildingInfo {

    /** 楼层数 */
    private Integer height;

    @Override
    public String getBuildingType() {
        return "teaching";
    }
}
