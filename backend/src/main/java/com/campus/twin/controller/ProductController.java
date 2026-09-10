package com.campus.twin.controller;

import com.campus.twin.common.Result;
import com.campus.twin.entity.Product;
import com.campus.twin.service.ProductService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "产品管理接口", description = "外卖产品查询（MVP阶段只做查询）")
@RestController
@RequestMapping("/api/product")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    @Operation(summary = "产品列表（支持按餐厅/分类/关键词筛选）")
    @GetMapping("/list")
    public Result<List<Product>> list(
            @RequestParam(required = false) Integer restaurantId,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String keyword) {
        return Result.success(productService.list(restaurantId, category, keyword));
    }

    @Operation(summary = "产品详情")
    @GetMapping("/{id}")
    public Result<Product> getById(@PathVariable Integer id) {
        Product product = productService.getById(id);
        if (product == null) {
            return Result.error("产品不存在");
        }
        return Result.success(product);
    }

    @Operation(summary = "热销产品榜")
    @GetMapping("/hot")
    public Result<List<Product>> getHotProducts(
            @RequestParam(defaultValue = "10") Integer limit) {
        return Result.success(productService.getHotProducts(limit));
    }
}
