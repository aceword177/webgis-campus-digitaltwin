package com.campus.twin.controller;

import com.campus.twin.common.Result;
import com.campus.twin.dto.RestaurantDetailVO;
import com.campus.twin.entity.Product;
import com.campus.twin.entity.Restaurant;
import com.campus.twin.service.ProductService;
import com.campus.twin.service.RestaurantService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "餐厅管理接口", description = "餐厅列表、详情、产品")
@RestController
@RequestMapping("/api/restaurant")
@RequiredArgsConstructor
public class RestaurantController {

    private final RestaurantService restaurantService;
    private final ProductService productService;

    @Operation(summary = "餐厅列表")
    @GetMapping("/list")
    public Result<List<Restaurant>> list() {
        return Result.success(restaurantService.list());
    }

    @Operation(summary = "餐厅详情（含建筑坐标）")
    @GetMapping("/{id}")
    public Result<RestaurantDetailVO> getDetail(@PathVariable Integer id) {
        RestaurantDetailVO detail = restaurantService.getDetail(id);
        if (detail == null) {
            return Result.error("餐厅不存在");
        }
        return Result.success(detail);
    }

    @Operation(summary = "餐厅的产品列表")
    @GetMapping("/{id}/products")
    public Result<List<Product>> getProducts(
            @PathVariable Integer id,
            @RequestParam(required = false) String category) {
        return Result.success(productService.getByRestaurantId(id, category));
    }
}
