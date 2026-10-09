package com.campus.twin.common;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 全局异常处理器
 *
 * <p>两条原则：
 * <ol>
 *   <li><b>HTTP 状态码必须与业务结果一致</b>：此前所有异常都返回 HTTP 200 + body 内 code，
 *       导致任何信任 HTTP 状态的客户端/代理/监控探针都把失败当成功，REST 语义丢失。
 *       现在按异常类别映射 400/404/500。</li>
 *   <li><b>不把内部异常原文暴露给客户端</b>：此前 {@code "服务器内部错误: " + e.getMessage()}
 *       会把 SQL 语句、表名、列名直接回给前端。现在对外返回通用文案，
 *       详细信息只写服务端日志。</li>
 * </ol>
 *
 * <p>响应体保持前端既有的 {@code {code, message, data}} 结构，并额外附加
 * {@code fieldErrors}（仅校验失败时存在），前端可据此定位具体字段。
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /** 业务参数错误：客户端问题 → 400 */
    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Result<Map<String, Object>> handleIllegalArgumentException(
            IllegalArgumentException e, HttpServletRequest request) {
        log.warn("参数校验失败 [{} {}]: {}", request.getMethod(), request.getRequestURI(), e.getMessage());
        return Result.error(ResultCode.BAD_REQUEST.getCode(), e.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Result<Map<String, Object>> handleIllegalStateException(
            IllegalStateException e, HttpServletRequest request) {
        log.warn("状态不允许 [{} {}]: {}", request.getMethod(), request.getRequestURI(), e.getMessage());
        return Result.error(ResultCode.BAD_REQUEST.getCode(), e.getMessage());
    }

    /** 资源不存在 → **真实 HTTP 404**（此前是 200 + body 内 code，语义错误） */
    @ExceptionHandler(ResourceNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Result<Map<String, Object>> handleResourceNotFound(
            ResourceNotFoundException e, HttpServletRequest request) {
        log.warn("资源不存在 [{} {}]: {}", request.getMethod(), request.getRequestURI(), e.getMessage());
        return Result.error(ResultCode.NOT_FOUND.getCode(), e.getMessage());
    }

    /** @Valid 请求体校验失败 → 400，附字段级明细 */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Result<Map<String, String>> handleMethodArgumentNotValid(
            MethodArgumentNotValidException e, HttpServletRequest request) {
        Map<String, String> fieldErrors = e.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(
                        FieldError::getField,
                        fe -> fe.getDefaultMessage() != null ? fe.getDefaultMessage() : "参数不合法",
                        (a, b) -> a,
                        LinkedHashMap::new));
        String summary = fieldErrors.isEmpty()
                ? "请求参数校验失败"
                : fieldErrors.entrySet().stream()
                        .map(en -> en.getKey() + ": " + en.getValue())
                        .collect(Collectors.joining("; "));
        log.warn("请求体校验失败 [{} {}]: {}", request.getMethod(), request.getRequestURI(), summary);
        return Result.error(ResultCode.BAD_REQUEST.getCode(), summary, fieldErrors);
    }

    /** 表单/查询参数绑定校验失败（含 @Validated 在方法参数上的场景） */
    @ExceptionHandler({BindException.class, ConstraintViolationException.class})
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Result<Map<String, String>> handleBindingException(
            Exception e, HttpServletRequest request) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        if (e instanceof BindException be) {
            for (FieldError fe : be.getBindingResult().getFieldErrors()) {
                fieldErrors.put(fe.getField(),
                        fe.getDefaultMessage() != null ? fe.getDefaultMessage() : "参数不合法");
            }
        } else if (e instanceof ConstraintViolationException cve) {
            for (ConstraintViolation<?> v : cve.getConstraintViolations()) {
                fieldErrors.put(String.valueOf(v.getPropertyPath()), v.getMessage());
            }
        }
        String summary = fieldErrors.isEmpty()
                ? "请求参数校验失败"
                : String.join("; ", fieldErrors.entrySet().stream()
                        .map(en -> en.getKey() + ": " + en.getValue()).toList());
        log.warn("参数绑定校验失败 [{} {}]: {}", request.getMethod(), request.getRequestURI(), summary);
        return Result.error(ResultCode.BAD_REQUEST.getCode(), summary, fieldErrors);
    }

    /** 路径/查询参数类型不匹配，例如 ?lng=abc → 400（此前会被当成 500 并回显类型转换细节） */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Result<Map<String, Object>> handleTypeMismatch(
            MethodArgumentTypeMismatchException e, HttpServletRequest request) {
        String required = e.getRequiredType() != null ? e.getRequiredType().getSimpleName() : "期望类型";
        String msg = "参数 " + e.getName() + " 类型不正确，应为 " + required;
        log.warn("参数类型不匹配 [{} {}]: {}", request.getMethod(), request.getRequestURI(), msg);
        return Result.error(ResultCode.BAD_REQUEST.getCode(), msg);
    }

    /** 缺少必填请求参数 → 400 */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Result<Map<String, Object>> handleMissingParam(
            MissingServletRequestParameterException e, HttpServletRequest request) {
        String msg = "缺少必填参数: " + e.getParameterName();
        log.warn("缺少必填参数 [{} {}]: {}", request.getMethod(), request.getRequestURI(), msg);
        return Result.error(ResultCode.BAD_REQUEST.getCode(), msg);
    }

    /**
     * 兜底：未预期的运行时异常 → 500。
     * 对外只给通用文案，堆栈与原文只进服务端日志，避免泄露 SQL/表结构等内部信息。
     */
    @ExceptionHandler(RuntimeException.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public Result<Map<String, Object>> handleRuntimeException(
            RuntimeException e, HttpServletRequest request) {
        log.error("运行时异常 [{} {}]", request.getMethod(), request.getRequestURI(), e);
        return Result.error(ResultCode.ERROR.getCode(), "服务器内部错误，请稍后重试或联系管理员");
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public Result<Map<String, Object>> handleException(
            Exception e, HttpServletRequest request) {
        log.error("系统异常 [{} {}]", request.getMethod(), request.getRequestURI(), e);
        return Result.error(ResultCode.ERROR.getCode(), "系统异常，请联系管理员");
    }
}
