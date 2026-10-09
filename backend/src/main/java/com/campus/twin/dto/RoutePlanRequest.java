package com.campus.twin.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.io.Serializable;

/**
 * 航线规划请求
 *
 * <p>校验说明：字段初始值（如 {@code altitude = 50.0}）**只在 JSON 键缺失时生效**。
 * 客户端显式传 {@code "altitude": null} 会把字段置为 null，从而在
 * {@code RouteServiceImpl} 里对 {@code BigDecimal.valueOf(null)} 拆箱抛 NPE。
 * 因此这里的 {@code @NotNull} 是必需的防御，不能依赖字段初始值。
 */
@Data
public class RoutePlanRequest implements Serializable {

    @NotNull(message = "起点经度不能为空")
    @DecimalMin(value = "-180.0", message = "起点经度超出有效范围")
    @DecimalMax(value = "180.0", message = "起点经度超出有效范围")
    private Double startLng;

    @NotNull(message = "起点纬度不能为空")
    @DecimalMin(value = "-90.0", message = "起点纬度超出有效范围")
    @DecimalMax(value = "90.0", message = "起点纬度超出有效范围")
    private Double startLat;

    @NotNull(message = "终点经度不能为空")
    @DecimalMin(value = "-180.0", message = "终点经度超出有效范围")
    @DecimalMax(value = "180.0", message = "终点经度超出有效范围")
    private Double endLng;

    @NotNull(message = "终点纬度不能为空")
    @DecimalMin(value = "-90.0", message = "终点纬度超出有效范围")
    @DecimalMax(value = "90.0", message = "终点纬度超出有效范围")
    private Double endLat;

    /**
     * 飞行高度(米)，默认50。
     * 注意：可为 null（客户端不传时由业务层回落到默认值），
     * 但一旦传值就必须落在合理区间内——避免负数或贴地高度。
     */
    @DecimalMin(value = "5.0", message = "飞行高度不能低于 5 米")
    @DecimalMax(value = "500.0", message = "飞行高度不能高于 500 米")
    private Double altitude = 50.0;
}
