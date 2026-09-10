package com.campus.twin.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import lombok.Data;

import java.io.Serializable;

/**
 * 空间实体基类
 * 所有空间数据表的公共字段
 * geom 字段用 String 接收，查询时通过 ST_AsGeoJSON 转为 GeoJSON 字符串
 */
@Data
public abstract class BaseSpatialEntity implements Serializable {

    @TableId(type = IdType.AUTO)
    private Integer id;

    /** 名称（部分表无此字段，子类用 @TableField(exist=false) 标记） */
    private String name;

    /** 空间几何 - GeoJSON 字符串格式 */
    @TableField("geom")
    private String geom;

    /** 周长/长度（SHAPE_Leng） */
    @TableField("\"SHAPE_Leng\"")
    private Double shapeLeng;
}
