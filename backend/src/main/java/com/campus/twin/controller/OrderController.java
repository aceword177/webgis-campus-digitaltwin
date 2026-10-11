package com.campus.twin.controller;

import com.campus.twin.common.ResourceNotFoundException;
import com.campus.twin.common.Result;
import com.campus.twin.dto.AutoOrderStatusVO;
import com.campus.twin.dto.AutoOrderSwitchRequest;
import com.campus.twin.dto.DeliveryStatsVO;
import com.campus.twin.dto.OrderCreateRequest;
import com.campus.twin.dto.OrderDetailVO;
import com.campus.twin.dto.OrderListVO;
import com.campus.twin.entity.DeliveryOrder;
import com.campus.twin.service.AutoOrderSwitch;
import com.campus.twin.service.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "订单管理接口", description = "配送订单的创建、分配、送达、取消、统计")
@RestController
@RequestMapping("/api/order")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;
    private final AutoOrderSwitch autoOrderSwitch;

    /** 单页最大条数上限：防止 ?size=1000000 让服务端一次性物化百万行 */
    private static final int MAX_PAGE_SIZE = 200;

    @Operation(summary = "订单列表（支持状态筛选和分页，含餐厅/宿舍楼名称）")
    @GetMapping("/list")
    public Result<List<OrderListVO>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "20") Integer size) {
        // 显式钳制分页参数，避免恶意/误用的超大 size 造成内存与延迟压力
        int safePage = (page == null || page < 1) ? 1 : page;
        int safeSize = (size == null || size < 1) ? 20 : Math.min(size, MAX_PAGE_SIZE);
        return Result.success(orderService.list(status, safePage, safeSize));
    }

    @Operation(summary = "订单详情（含餐厅/宿舍楼/无人机/航线信息）")
    @GetMapping("/{id}")
    public Result<OrderDetailVO> getDetail(@PathVariable Integer id) {
        OrderDetailVO detail = orderService.getDetail(id);
        if (detail == null) {
            throw new ResourceNotFoundException("订单", id);
        }
        return Result.success(detail);
    }

    @Operation(summary = "创建订单")
    @PostMapping("/create")
    public Result<DeliveryOrder> create(@Valid @RequestBody OrderCreateRequest request) {
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

    // ===== 自动补单开关 =====
    // 路径刻意用两段（/auto-order/status），避免与上面的 @GetMapping("/{id}") 抢路由
    // —— 单段的 /auto-order 会被当成 {id} 去转 Integer，直接 400。

    @Operation(summary = "查询自动补单开关状态（默认关闭）")
    @GetMapping("/auto-order/status")
    public Result<AutoOrderStatusVO> getAutoOrderStatus() {
        return Result.success(currentAutoOrderStatus());
    }

    @Operation(summary = "开关自动补单（开启后每 30 秒自动生成订单并派单）")
    @PutMapping("/auto-order/status")
    public Result<AutoOrderStatusVO> updateAutoOrderStatus(@Valid @RequestBody AutoOrderSwitchRequest request) {
        autoOrderSwitch.switchTo(Boolean.TRUE.equals(request.getEnabled()));
        return Result.success(currentAutoOrderStatus());
    }

    private AutoOrderStatusVO currentAutoOrderStatus() {
        return AutoOrderStatusVO.builder()
                .enabled(autoOrderSwitch.isEnabled())
                .generated(autoOrderSwitch.getGenerated())
                .build();
    }
}
