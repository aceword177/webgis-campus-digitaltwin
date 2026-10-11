package com.campus.twin.dto;

import lombok.Builder;
import lombok.Data;

import java.io.Serializable;

/** 自动补单开关状态：前端开关控件与顶部横幅共用 */
@Data
@Builder
public class AutoOrderStatusVO implements Serializable {

    /** 自动补单是否开启（默认 false） */
    private Boolean enabled;

    /** 本次开启以来自动生成的订单数（关闭时为 0） */
    private Long generated;
}
