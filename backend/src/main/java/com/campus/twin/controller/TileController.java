package com.campus.twin.controller;

import com.campus.twin.service.TileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.io.OutputStream;

/**
 * MVT 矢量瓦片控制器
 * 返回 application/x-protobuf 格式的矢量瓦片二进制数据
 */
@Tag(name = "MVT矢量瓦片接口", description = "PostGIS 原生 ST_AsMVT 输出矢量瓦片")
@RestController
@RequestMapping("/tiles")
@RequiredArgsConstructor
public class TileController {

    private final TileService tileService;

    @Operation(summary = "获取指定表的 MVT 矢量瓦片")
    @GetMapping(value = "/{table}/{z}/{x}/{y}.mvt", produces = "application/x-protobuf")
    public void getMvtTile(
            @PathVariable String table,
            @PathVariable Integer z,
            @PathVariable Integer x,
            @PathVariable Integer y,
            HttpServletResponse response) throws IOException {

        byte[] mvtData = tileService.getMvtTile(table, z, x, y);

        response.setContentType("application/x-protobuf");
        response.setContentLength(mvtData.length);
        // 瓦片缓存 1 小时
        response.setHeader("Cache-Control", "public, max-age=3600");

        try (OutputStream out = response.getOutputStream()) {
            out.write(mvtData);
            out.flush();
        }
    }
}
