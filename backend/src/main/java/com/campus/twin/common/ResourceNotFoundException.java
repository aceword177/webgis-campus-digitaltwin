package com.campus.twin.common;

/**
 * 资源不存在异常。
 *
 * <p>为什么需要它：控制器里"资源不存在"此前是 {@code return Result.error("xxx不存在")}，
 * 只把 {@code code=500} 写进响应体，**HTTP 状态码仍是 200**。
 * 这会让任何信任 HTTP 状态的客户端、代理、监控探针都把"查不到"当成"查询成功"，
 * 同时让 {@link ResultCode#NOT_FOUND} 变成死代码。
 *
 * <p>改为抛出本异常后，由 {@link GlobalExceptionHandler} 统一映射为
 * **HTTP 404 + body.code=404**，语义正确且前端仍可分支处理。
 */
public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String message) {
        super(message);
    }

    /** 便捷构造：如 {@code new ResourceNotFoundException("订单", id)} → "订单不存在: 12" */
    public ResourceNotFoundException(String resource, Object id) {
        super(resource + "不存在" + (id != null ? ": " + id : ""));
    }
}
