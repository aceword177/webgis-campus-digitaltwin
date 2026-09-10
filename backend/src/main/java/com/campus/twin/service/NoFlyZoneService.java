package com.campus.twin.service;

import com.campus.twin.entity.NoFlyZone;

import java.util.List;
import java.util.Map;

public interface NoFlyZoneService {

    List<NoFlyZone> list(String level);

    /** 检测线段是否穿越限飞区 */
    List<Map<String, Object>> checkLineCross(Double startLng, Double startLat, Double endLng, Double endLat);
}
