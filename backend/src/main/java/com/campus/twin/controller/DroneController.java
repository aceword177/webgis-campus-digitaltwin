package com.campus.twin.controller;

import com.campus.twin.common.ResourceNotFoundException;
import com.campus.twin.common.Result;
import com.campus.twin.dto.DroneStatsVO;
import com.campus.twin.entity.Drone;
import com.campus.twin.service.DroneService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "无人机管理接口", description = "无人机列表、详情、状态统计、位置更新")
@RestController
@RequestMapping("/api/drone")
@RequiredArgsConstructor
public class DroneController {

    private final DroneService droneService;

    @Operation(summary = "无人机列表（含实时位置和电量）")
    @GetMapping("/list")
    public Result<List<Drone>> list(
            @RequestParam(required = false) String status) {
        return Result.success(droneService.list(status));
    }

    @Operation(summary = "无人机详情")
    @GetMapping("/{id}")
    public Result<Drone> getById(@PathVariable Integer id) {
        Drone drone = droneService.getById(id);
        if (drone == null) {
            throw new ResourceNotFoundException("无人机", id);
        }
        return Result.success(drone);
    }

    @Operation(summary = "无人机状态统计")
    @GetMapping("/stats")
    public Result<DroneStatsVO> getStats() {
        return Result.success(droneService.getStats());
    }

    @Operation(summary = "更新无人机位置和电量（模拟实时上报）")
    @PostMapping("/{id}/update-position")
    public Result<Drone> updatePosition(
            @PathVariable Integer id,
            @RequestParam Double lng,
            @RequestParam Double lat,
            @RequestParam(required = false) Integer battery) {
        return Result.success(droneService.updatePosition(id, lng, lat, battery));
    }
}
