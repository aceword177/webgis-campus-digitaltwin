package com.campus.twin.controller;

import com.campus.twin.common.Result;
import com.campus.twin.dto.DeliveryStatsVO;
import com.campus.twin.dto.OrderCreateRequest;
import com.campus.twin.dto.OrderDetailVO;
import com.campus.twin.entity.DeliveryOrder;
import com.campus.twin.service.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "订单管理接口", description = "配送订单的创建、分配、送达、取消、统计")
@RestController
@RequestMapping("/api/order")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @Operation(summary = "订单列表（支持状态筛选和分页）")
    @GetMapping("/list")
    public Result<List<DeliveryOrder>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "20") Integer size) {
        return Result.success(orderService.list(status, page, size));
    }

    @Operation(summary = "订单详情（含餐厅/宿舍楼/无人机/航线信息）")
    @GetMapping("/{id}")
    public Result<OrderDetailVO> getDetail(@PathVariable Integer id) {
        OrderDetailVO detail = orderService.getDetail(id);
        if (detail == null) {
            return Result.error("订单不存在");
        }
        return Result.success(detail);
    }

    @Operation(summary = "创建订单")
    @PostMapping("/create")
    public Result<DeliveryOrder> create(@RequestBody OrderCreateRequest request) {
        return Result.success(orderService.create(request));
    }

    @Operation(summary = "分配无人机（自动调度，同时规划航线）")
    @PostMapping("/{id}/assign")
    public Result<DeliveryOrder> assignDrone(
            @PathVariable Integer id,
            @RequestParam(required = false) Integer droneId) {
        return Result.success(orderService.assignDrone(id, droneId));
    }

    @Operation(summary = "确认送达")
    @PostMapping("/{id}/deliver")
    public Result<DeliveryOrder> confirmDeliver(@PathVariable Integer id) {
        return Result.success(orderService.confirmDeliver(id));
    }

    @Operation(summary = "取消订单")
    @PostMapping("/{id}/cancel")
    public Result<DeliveryOrder> cancel(
            @PathVariable Integer id,
            @RequestParam(required = false) String reason) {
        return Result.success(orderService.cancel(id, reason));
    }

    @Operation(summary = "配送统计")
    @GetMapping("/stats")
    public Result<DeliveryStatsVO> getStats() {
        return Result.success(orderService.getDeliveryStats());
    }
}
