package com.campus.twin.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 外卖产品实体
 */
@Data
@TableName("product")
public class Product implements Serializable {

    @TableId(type = IdType.AUTO)
    private Integer id;

    private Integer restaurantId;

    private String name;

    /** 分类：主食/小吃/饮品/套餐 */
    private String category;

    private BigDecimal price;

    private String description;

    private String image;

    private Integer sales;

    /** 状态：on(上架)/off(下架) */
    private String status;

    private LocalDateTime createTime;
}
