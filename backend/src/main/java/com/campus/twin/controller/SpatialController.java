package com.campus.twin.controller;

import com.campus.twin.common.ResourceNotFoundException;
import com.campus.twin.common.Result;
import com.campus.twin.dto.LayerMeta;
import com.campus.twin.service.SpatialService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 空间查询控制器
 */
@Tag(name = "空间查询接口", description = "点选、缓冲区、GeoJSON、图层元数据等空间查询")
@RestController
@RequestMapping("/api/spatial")
@RequiredArgsConstructor
public class SpatialController {

    private final SpatialService spatialService;

    /** 缓冲区查询半径上界（米）：校园尺度下 5km 已远超任何合理需求 */
    private static final double MAX_BUFFER_RADIUS_M = 5000.0;

    @Operation(summary = "获取所有图层元数据")
    @GetMapping("/layers")
    public Result<List<LayerMeta>> getLayers() {
        return Result.success(spatialService.getAllLayers());
    }

    @Operation(summary = "点选查询 - 根据经纬度查询落在哪个要素上")
    @GetMapping("/point-query")
    public Result<Map<String, Object>> pointQuery(
            @Parameter(description = "表名", required = true) @RequestParam String table,
            @Parameter(description = "经度", required = true) @RequestParam Double lng,
            @Parameter(description = "纬度", required = true) @RequestParam Double lat) {
        Map<String, Object> result = spatialService.pointQuery(table, lng, lat);
        if (result == null) {
            return Result.success("未查询到要素", null);
        }
        return Result.success(result);
    }

    @Operation(summary = "缓冲区查询 - 查询指定半径范围内的要素")
    @GetMapping("/buffer")
    public Result<List<Map<String, Object>>> bufferQuery(
            @Parameter(description = "表名", required = true) @RequestParam String table,
            @Parameter(description = "经度", required = true) @RequestParam Double lng,
            @Parameter(description = "纬度", required = true) @RequestParam Double lat,
            @Parameter(description = "半径(米)", required = true) @RequestParam(defaultValue = "100") Double radius) {
        // radius 语义是「米」，需要显式约束：
        // 非正数无意义；上界防止一次查询把整表 geography 计算拉满
        if (radius == null || radius <= 0) {
            throw new IllegalArgumentException("缓冲半径必须为正数（单位：米）");
        }
        if (radius > MAX_BUFFER_RADIUS_M) {
            throw new IllegalArgumentException("缓冲半径不能超过 " + (int) MAX_BUFFER_RADIUS_M + " 米");
        }
        return Result.success(spatialService.bufferQuery(table, lng, lat, radius));
    }

    @Operation(summary = "按表名输出完整 GeoJSON 数据")
    @GetMapping("/geojson/{table}")
    public Result<List<Map<String, Object>>> getGeoJson(
            @Parameter(description = "表名", required = true) @PathVariable String table) {
        return Result.success(spatialService.getGeoJson(table));
    }

    @Operation(summary = "根据 ID 查询要素详情")
    @GetMapping("/building/{table}/{id}")
    public Result<Map<String, Object>> getById(
            @Parameter(description = "表名", required = true) @PathVariable String table,
            @Parameter(description = "要素 ID", required = true) @PathVariable Integer id) {
        Map<String, Object> result = spatialService.getById(table, id);
        if (result == null) {
            throw new ResourceNotFoundException("要素", id);
        }
        return Result.success(result);
    }

    @Operation(summary = "获取校园边界范围和中心点")
    @GetMapping("/campus-bounds")
    public Result<Map<String, Object>> getCampusBounds() {
        return Result.success(spatialService.getCampusBounds());
    }
}
