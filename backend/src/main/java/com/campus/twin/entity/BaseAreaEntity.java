package com.campus.twin.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 有面积字段的空间实体基类（面要素）
 * 道路线要素直接继承 BaseSpatialEntity，不继承此类
 */
@Data
@EqualsAndHashCode(callSuper = true)
public abstract class BaseAreaEntity extends BaseSpatialEntity {

    /** 面积（SHAPE_Area） */
    @TableField("\"SHAPE_Area\"")
    private Double shapeArea;
}
