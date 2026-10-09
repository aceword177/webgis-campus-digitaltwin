package com.campus.twin.common;

import lombok.Data;

import java.io.Serializable;

/**
 * 统一响应结果
 *
 * @param <T> 数据类型
 */
@Data
public class Result<T> implements Serializable {

    private Integer code;
    private String message;
    private T data;

    private Result() {
    }

    public static <T> Result<T> success() {
        Result<T> result = new Result<>();
        result.setCode(ResultCode.SUCCESS.getCode());
        result.setMessage(ResultCode.SUCCESS.getMessage());
        return result;
    }

    public static <T> Result<T> success(T data) {
        Result<T> result = success();
        result.setData(data);
        return result;
    }

    public static <T> Result<T> success(String message, T data) {
        Result<T> result = success(data);
        result.setMessage(message);
        return result;
    }

    public static <T> Result<T> error(String message) {
        Result<T> result = new Result<>();
        result.setCode(ResultCode.ERROR.getCode());
        result.setMessage(message);
        return result;
    }

    public static <T> Result<T> error(Integer code, String message) {
        Result<T> result = new Result<>();
        result.setCode(code);
        result.setMessage(message);
        return result;
    }

    /**
     * 带明细数据的错误响应。
     * 主要用于校验失败时回传字段级错误（{@code {"startLng":"起点经度不能为空"}}），
     * 前端可据此把错误定位到具体表单项，而不是只弹一句笼统提示。
     */
    public static <T> Result<T> error(Integer code, String message, T data) {
        Result<T> result = error(code, message);
        result.setData(data);
        return result;
    }

    public static <T> Result<T> error(ResultCode resultCode) {
        return error(resultCode.getCode(), resultCode.getMessage());
    }
}
