package com.campus.twin.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 宿舍楼
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("dormitory")
public class Dormitory extends BaseAreaEntity implements BuildingInfo {

    /** 楼层数 */
    private Integer height;

    /** 宿舍性别：男 / 女（点击弹窗展示） */
    private String gender;

    @Override
    public String getBuildingType() {
        return "dormitory";
    }
}
