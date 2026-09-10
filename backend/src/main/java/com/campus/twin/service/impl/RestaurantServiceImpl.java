package com.campus.twin.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.campus.twin.dto.RestaurantDetailVO;
import com.campus.twin.entity.Restaurant;
import com.campus.twin.mapper.RestaurantMapper;
import com.campus.twin.mapper.SpatialQueryMapper;
import com.campus.twin.service.RestaurantService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class RestaurantServiceImpl implements RestaurantService {

    private final RestaurantMapper restaurantMapper;
    private final SpatialQueryMapper spatialQueryMapper;
    private final ObjectMapper objectMapper;

    @Override
    public List<Restaurant> list() {
        return restaurantMapper.selectList(null);
    }

    @Override
    public RestaurantDetailVO getDetail(Integer id) {
        Restaurant restaurant = restaurantMapper.selectById(id);
        if (restaurant == null) {
            return null;
        }

        // 查询关联建筑的空间信息
        Map<String, Object> building = spatialQueryMapper.selectById("other_buildings", restaurant.getBuildingId());

        RestaurantDetailVO.RestaurantDetailVOBuilder builder = RestaurantDetailVO.builder()
                .id(restaurant.getId())
                .buildingId(restaurant.getBuildingId())
                .name(restaurant.getName())
                .windowCount(restaurant.getWindowCount())
                .openTime(restaurant.getOpenTime())
                .rating(restaurant.getRating())
                .phone(restaurant.getPhone());

        if (building != null) {
            builder.buildingGeojson((String) building.get("geom"));
            // centroid 是 ST_AsGeoJSON 返回的 JSON 字符串，需要解析
            String centroidStr = (String) building.get("centroid");
            if (centroidStr != null) {
                try {
                    Map<String, Object> centroid = objectMapper.readValue(centroidStr, Map.class);
                    List<Double> coords = (List<Double>) centroid.get("coordinates");
                    if (coords != null && coords.size() >= 2) {
                        builder.centerLng(coords.get(0));
                        builder.centerLat(coords.get(1));
                    }
                } catch (Exception e) {
                    log.warn("解析餐厅建筑质心失败: {}", e.getMessage());
                }
            }
        }

        return builder.build();
    }

    @Override
    public Restaurant getById(Integer id) {
        return restaurantMapper.selectById(id);
    }
}
