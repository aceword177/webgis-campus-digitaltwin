package com.campus.twin.service.impl;

import com.campus.twin.dto.LayerMeta;
import com.campus.twin.mapper.SpatialQueryMapper;
import com.campus.twin.service.SpatialService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * 空间查询服务实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SpatialServiceImpl implements SpatialService {

    private final SpatialQueryMapper spatialQueryMapper;

    /** 允许查询的表名白名单（防止 SQL 注入） */
    private static final Set<String> ALLOWED_TABLES = Set.of(
            "school", "teaching_building", "dormitory", "other_buildings",
            "road", "playground", "basketball_court", "tennis_court"
    );

    /** 表名 -> 中文标签映射 */
    private static final Map<String, String> TABLE_LABELS = Map.ofEntries(
            Map.entry("school", "校园边界"),
            Map.entry("teaching_building", "教学楼"),
            Map.entry("dormitory", "宿舍楼"),
            Map.entry("other_buildings", "其他建筑"),
            Map.entry("road", "道路"),
            Map.entry("playground", "操场"),
            Map.entry("basketball_court", "篮球场"),
            Map.entry("tennis_court", "网球场")
    );

    /** 有 height 字段的表 */
    private static final Set<String> TABLES_WITH_HEIGHT = Set.of(
            "teaching_building", "dormitory", "other_buildings"
    );

    /** 线要素表 */
    private static final Set<String> LINE_TABLES = Set.of("road");

    private List<LayerMeta> layerCache;

    @PostConstruct
    public void init() {
        layerCache = new ArrayList<>();
        for (String table : ALLOWED_TABLES) {
            try {
                Integer count = spatialQueryMapper.selectCount(table);
                layerCache.add(LayerMeta.builder()
                        .tableName(table)
                        .label(TABLE_LABELS.getOrDefault(table, table))
                        .geometryType(LINE_TABLES.contains(table) ? "line" : "polygon")
                        .count(count)
                        .hasHeight(TABLES_WITH_HEIGHT.contains(table))
                        .build());
            } catch (Exception e) {
                log.warn("查询表 {} 记录数失败: {}", table, e.getMessage());
            }
        }
        log.info("图层元数据缓存初始化完成，共 {} 个图层", layerCache.size());
    }

    @Override
    public List<LayerMeta> getAllLayers() {
        return layerCache;
    }

    @Override
    public Map<String, Object> pointQuery(String table, Double lng, Double lat) {
        validateTable(table);
        List<Map<String, Object>> results = spatialQueryMapper.selectByPoint(table, lng, lat);
        return results.isEmpty() ? null : results.get(0);
    }

    @Override
    public List<Map<String, Object>> bufferQuery(String table, Double lng, Double lat, Double radius) {
        validateTable(table);
        return spatialQueryMapper.selectByBuffer(table, lng, lat, radius);
    }

    @Override
    public List<Map<String, Object>> getGeoJson(String table) {
        validateTable(table);
        return spatialQueryMapper.selectAllGeoJson(table);
    }

    @Override
    public Map<String, Object> getById(String table, Integer id) {
        validateTable(table);
        return spatialQueryMapper.selectById(table, id);
    }

    @Override
    public Map<String, Object> getCampusBounds() {
        return spatialQueryMapper.selectCampusBounds();
    }

    @Override
    public void validateTable(String table) {
        if (table == null || !ALLOWED_TABLES.contains(table)) {
            throw new IllegalArgumentException("非法的表名: " + table + "，允许的表名: " + ALLOWED_TABLES);
        }
    }
}
