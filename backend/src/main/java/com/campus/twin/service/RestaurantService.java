package com.campus.twin.service;

import com.campus.twin.dto.CanteenCoverageVO;
import com.campus.twin.dto.RestaurantDetailVO;
import com.campus.twin.entity.Restaurant;

import java.util.List;

public interface RestaurantService {

    List<Restaurant> list();

    RestaurantDetailVO getDetail(Integer id);

    Restaurant getById(Integer id);

    /** 食堂缓冲区覆盖：按导航路径时间（30s/60s/90s）分档 */
    List<CanteenCoverageVO> getCoverage();
}
