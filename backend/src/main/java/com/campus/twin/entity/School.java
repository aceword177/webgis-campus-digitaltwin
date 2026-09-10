package com.campus.twin.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 校园边界
 * 注意：school 表没有 name 字段
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("school")
public class School extends BaseAreaEntity {

    /** school 表无 name 字段 */
    @TableField(exist = false)
    private String name;
}
