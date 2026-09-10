package com.campus.twin.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 道路（线要素）
 * 注意：road 表没有 SHAPE_Area 字段，直接继承 BaseSpatialEntity
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("road")
public class Road extends BaseSpatialEntity {
}
