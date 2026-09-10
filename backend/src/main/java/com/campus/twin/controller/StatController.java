package com.campus.twin.controller;

import com.campus.twin.common.Result;
import com.campus.twin.dto.CampusOverview;
import com.campus.twin.service.StatService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 统计控制器
 */
@Tag(name = "统计接口", description = "校园概览统计")
@RestController
@RequestMapping("/api/stat")
@RequiredArgsConstructor
public class StatController {

    private final StatService statService;

    @Operation(summary = "获取校园概览统计")
    @GetMapping("/overview")
    public Result<CampusOverview> getOverview() {
        return Result.success(statService.getOverview());
    }
}
