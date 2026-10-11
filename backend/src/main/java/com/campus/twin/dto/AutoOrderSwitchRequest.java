package com.campus.twin.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.io.Serializable;

/** 切换自动补单开关的请求体 */
@Data
public class AutoOrderSwitchRequest implements Serializable {

    @NotNull(message = "enabled 不能为空")
    private Boolean enabled;
}
