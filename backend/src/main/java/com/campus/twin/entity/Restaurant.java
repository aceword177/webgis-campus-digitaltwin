package com.campus.twin.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 餐厅实体
 */
@Data
@TableName("restaurant")
public class Restaurant implements Serializable {

    @TableId(type = IdType.AUTO)
    private Integer id;

    /** 关联 other_buildings.id */
    private Integer buildingId;

    private String name;

    /** 出餐窗口数 */
    private Integer windowCount;

    private String openTime;

    private Double rating;

    private String phone;

    private LocalDateTime createTime;
}
