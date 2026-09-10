package com.campus.twin.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 操场
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("playground")
public class Playground extends BaseAreaEntity {
}
