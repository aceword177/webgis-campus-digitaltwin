package com.campus.twin.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 篮球场
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("basketball_court")
public class BasketballCourt extends BaseAreaEntity {
}
