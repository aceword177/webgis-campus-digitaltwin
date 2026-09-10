package com.campus.twin.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 网球场
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tennis_court")
public class TennisCourt extends BaseAreaEntity {
}
