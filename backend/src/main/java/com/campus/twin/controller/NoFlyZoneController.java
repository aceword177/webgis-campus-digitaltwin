package com.campus.twin.controller;

import com.campus.twin.common.Result;
import com.campus.twin.entity.NoFlyZone;
import com.campus.twin.service.NoFlyZoneService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Tag(name = "限飞区接口", description = "限飞区列表、线段穿越检测")
@RestController
@RequestMapping("/api/no-fly-zone")
@RequiredArgsConstructor
public class NoFlyZoneController {

    private final NoFlyZoneService noFlyZoneService;

    @Operation(summary = "限飞区列表（GeoJSON）")
    @GetMapping("/list")
    public Result<List<NoFlyZone>> list(
            @RequestParam(required = false) String level) {
        return Result.success(noFlyZoneService.list(level));
    }

    @Operation(summary = "检测线段是否穿越限飞区")
    @PostMapping("/check")
    public Result<List<Map<String, Object>>> checkLineCross(
            @RequestParam Double startLng,
            @RequestParam Double startLat,
            @RequestParam Double endLng,
            @RequestParam Double endLat) {
        return Result.success(noFlyZoneService.checkLineCross(startLng, startLat, endLng, endLat));
    }
}
