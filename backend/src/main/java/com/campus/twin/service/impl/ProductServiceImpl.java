package com.campus.twin.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.campus.twin.entity.Product;
import com.campus.twin.mapper.ProductMapper;
import com.campus.twin.service.ProductService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductServiceImpl implements ProductService {

    private final ProductMapper productMapper;

    @Override
    public List<Product> list(Integer restaurantId, String category, String keyword) {
        LambdaQueryWrapper<Product> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Product::getStatus, "on");
        if (restaurantId != null) {
            wrapper.eq(Product::getRestaurantId, restaurantId);
        }
        if (StringUtils.hasText(category)) {
            wrapper.eq(Product::getCategory, category);
        }
        if (StringUtils.hasText(keyword)) {
            wrapper.like(Product::getName, keyword);
        }
        wrapper.orderByDesc(Product::getSales);
        return productMapper.selectList(wrapper);
    }

    @Override
    public Product getById(Integer id) {
        return productMapper.selectById(id);
    }

    @Override
    public List<Product> getByRestaurantId(Integer restaurantId, String category) {
        return list(restaurantId, category, null);
    }

    @Override
    public List<Product> getHotProducts(Integer limit) {
        LambdaQueryWrapper<Product> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Product::getStatus, "on")
                .orderByDesc(Product::getSales)
                .last("LIMIT " + (limit != null ? limit : 10));
        return productMapper.selectList(wrapper);
    }
}
