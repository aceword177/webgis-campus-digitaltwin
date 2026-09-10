package com.campus.twin.service;

import com.campus.twin.entity.Product;

import java.util.List;

public interface ProductService {

    List<Product> list(Integer restaurantId, String category, String keyword);

    Product getById(Integer id);

    List<Product> getByRestaurantId(Integer restaurantId, String category);

    List<Product> getHotProducts(Integer limit);
}
