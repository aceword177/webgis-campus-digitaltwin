package com.campus.twin.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.campus.twin.entity.NoFlyZone;
import com.campus.twin.mapper.NavigationMapper;
import com.campus.twin.mapper.NoFlyZoneMapper;
import com.campus.twin.service.NoFlyZoneService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class NoFlyZoneServiceImpl implements NoFlyZoneService {

    private final NoFlyZoneMapper noFlyZoneMapper;
    private final NavigationMapper navigationMapper;

    @Override
    public List<NoFlyZone> list(String level) {
        return noFlyZoneMapper.selectListWithGeoJson(level);
    }

    @Override
    public List<Map<String, Object>> checkLineCross(Double startLng, Double startLat, Double endLng, Double endLat) {
        return navigationMapper.checkLineCrossNoFlyZone(startLng, startLat, endLng, endLat);
    }
}
