package com.campus.twin.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 限飞区实体
 */
@Data
@TableName("no_fly_zone")
public class NoFlyZone implements Serializable {

    @TableId(type = IdType.AUTO)
    private Integer id;

    private String name;

    /** 来源表：playground / teaching_building */
    private String sourceTable;

    private Integer sourceId;

    /** 空间几何 - GeoJSON 字符串 */
    @TableField("geom")
    private String geom;

    /** 等级：strict(严格禁飞)/warning(警示) */
    private String level;

    private String reason;

    private LocalDateTime createTime;
}
