package com.campus.twin.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 其他建筑（体育馆、食堂、图书馆、行政楼等）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("other_buildings")
public class OtherBuilding extends BaseAreaEntity implements BuildingInfo {

    /** 楼层数 */
    private Integer height;

    @Override
    public String getBuildingType() {
        return "other";
    }
}
