package com.campus.twin.service;

import com.campus.twin.dto.RestaurantDetailVO;
import com.campus.twin.entity.Restaurant;

import java.util.List;

public interface RestaurantService {

    List<Restaurant> list();

    RestaurantDetailVO getDetail(Integer id);

    Restaurant getById(Integer id);
}
