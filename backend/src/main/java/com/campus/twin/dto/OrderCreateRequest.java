package com.campus.twin.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;

/**
 * 创建订单请求
 *
 * <p>校验分层原则：
 * <ul>
 *   <li>{@code @NotNull} 只加在**业务上不可缺省**的字段（关联 ID）上；</li>
 *   <li>可缺省字段（收货人、金额、备注等）不加 {@code @NotNull}，
 *       由 {@code OrderServiceImpl} 填默认值，避免破坏既有前端调用；</li>
 *   <li>{@code @DecimalMin} 对 null 视为通过，因此可安全用于"可选但有下界"的字段。</li>
 * </ul>
 */
@Data
public class OrderCreateRequest implements Serializable {

    @NotNull(message = "餐厅不能为空")
    @Positive(message = "餐厅 ID 必须为正整数")
    private Integer restaurantId;

    @NotNull(message = "收货宿舍楼不能为空")
    @Positive(message = "宿舍楼 ID 必须为正整数")
    private Integer dormitoryId;

    /** 收货人姓名，可为空（由业务层填默认值）；长度对齐 delivery_order.receiver_name VARCHAR(50) */
    @Size(max = 50, message = "收货人姓名不能超过 50 个字符")
    private String receiverName;

    /** 联系电话，长度对齐 delivery_order.receiver_phone VARCHAR(20) */
    @Size(max = 20, message = "联系电话不能超过 20 个字符")
    private String receiverPhone;

    /** 商品明细文本，长度对齐 delivery_order.items_text TEXT（给一个合理上限防滥用） */
    @Size(max = 500, message = "商品明细不能超过 500 个字符")
    private String itemsText;

    /** 金额，可为空（由业务层填 0）；不允许负数 */
    @DecimalMin(value = "0.0", message = "订单金额不能为负数")
    private BigDecimal amount;

    /** 备注，长度对齐 delivery_order.remark VARCHAR(255) */
    @Size(max = 255, message = "备注不能超过 255 个字符")
    private String remark;
}
