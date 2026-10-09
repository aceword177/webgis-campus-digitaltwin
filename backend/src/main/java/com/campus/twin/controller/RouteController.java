package com.campus.twin.controller;

import com.campus.twin.common.ResourceNotFoundException;
import com.campus.twin.common.Result;
import com.campus.twin.dto.RoutePlanRequest;
import com.campus.twin.dto.RoutePlanResponse;
import com.campus.twin.entity.FlightRoute;
import com.campus.twin.service.RouteService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "航线规划接口", description = "基于 pgrouting A* 的无人机航线规划")
@RestController
@RequestMapping("/api/route")
@RequiredArgsConstructor
public class RouteController {

    private final RouteService routeService;

    @Operation(summary = "规划航线（核心算法：pgr_astar 最短路径 + 限飞区避让）")
    @PostMapping("/plan")
    public Result<RoutePlanResponse> plan(@Valid @RequestBody RoutePlanRequest request) {
        return Result.success(routeService.plan(request));
    }

    @Operation(summary = "航线详情")
    @GetMapping("/{id}")
    public Result<FlightRoute> getById(@PathVariable Integer id) {
        FlightRoute route = routeService.getById(id);
        if (route == null) {
            // 抛出后由 GlobalExceptionHandler 映射为真实 HTTP 404
            throw new ResourceNotFoundException("航线", id);
        }
        return Result.success(route);
    }

    @Operation(summary = "根据订单ID查询航线")
    @GetMapping("/order/{orderId}")
    public Result<FlightRoute> getByOrderId(@PathVariable Integer orderId) {
        return Result.success(routeService.getByOrderId(orderId));
    }

    @Operation(summary = "当前飞行中的航线列表")
    @GetMapping("/active")
    public Result<List<FlightRoute>> getActiveRoutes() {
        return Result.success(routeService.getActiveRoutes());
    }
}
