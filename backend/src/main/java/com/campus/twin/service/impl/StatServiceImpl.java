package com.campus.twin.service.impl;

import com.campus.twin.dto.CampusOverview;
import com.campus.twin.mapper.SpatialQueryMapper;
import com.campus.twin.service.StatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * 统计服务实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StatServiceImpl implements StatService {

    private final SpatialQueryMapper spatialQueryMapper;

    @Override
    public CampusOverview getOverview() {
        Map<String, Object> buildingStats = spatialQueryMapper.selectBuildingStats();
        Map<String, Object> roadStats = spatialQueryMapper.selectRoadStats();
        Map<String, Object> campusBounds = spatialQueryMapper.selectCampusBounds();

        // 场地数量 = 操场 + 篮球场 + 网球场
        int venueCount = spatialQueryMapper.selectCount("playground")
                + spatialQueryMapper.selectCount("basketball_court")
                + spatialQueryMapper.selectCount("tennis_court");

        return CampusOverview.builder()
                .buildingCount(toInt(buildingStats.get("total_count")))
                .buildingArea(toDouble(buildingStats.get("total_area_sqm")))
                .avgFloors(toDouble(buildingStats.get("avg_floors")))
                .maxFloors(toInt(buildingStats.get("max_floors")))
                .roadCount(toInt(roadStats.get("total_count")))
                .roadLength(toDouble(roadStats.get("total_length_m")))
                .venueCount(venueCount)
                .centerLng(toDouble(campusBounds.get("center_lng")))
                .centerLat(toDouble(campusBounds.get("center_lat")))
                .campusArea(toDouble(campusBounds.get("area_sqm")))
                .build();
    }

    private Integer toInt(Object obj) {
        if (obj == null) return 0;
        if (obj instanceof Number) return ((Number) obj).intValue();
        return Integer.parseInt(obj.toString());
    }

    private Double toDouble(Object obj) {
        if (obj == null) return 0.0;
        if (obj instanceof Number) return ((Number) obj).doubleValue();
        return Double.parseDouble(obj.toString());
    }
}
