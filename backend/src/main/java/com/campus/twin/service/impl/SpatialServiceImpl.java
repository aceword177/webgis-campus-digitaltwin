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

    /**
     * 允许查询的表名白名单（防止 SQL 注入）。
     *
     * <p>用 List 而非 Set.of：{@code Set.of(...)} 的迭代顺序在 JVM 规范中**不作保证**，
     * 用它初始化 layerCache 会导致 {@code /api/spatial/layers} 返回的图层顺序
     * 每次重启都可能变化（难以复现、前端顺序也会莫名跳动）。
     * List 同时充当白名单的 O(n) 成员判断与固定展示顺序，n=8 无需担心性能。
     */
    private static final List<String> ALLOWED_TABLES = List.of(
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
        int failed = 0;
        for (String table : ALLOWED_TABLES) {
            Integer count = null;
            try {
                count = spatialQueryMapper.selectCount(table);
            } catch (Exception e) {
                failed++;
                // 用 toString() 而非 getMessage()：包装异常（如 CannotGetJdbcConnectionException）
                // 的 getMessage() 常为 null，会打出「失败: null」这种零信息日志
                log.warn("查询表 {} 记录数失败，count 置为 null: {}", table, e.toString());
            }
            // add 必须在 try 之外：否则查询失败的表会整层不进缓存，
            // 调用方看到的是「这层不存在」，而不是「这层存在但数量未知」
            layerCache.add(LayerMeta.builder()
                    .tableName(table)
                    .label(TABLE_LABELS.getOrDefault(table, table))
                    .geometryType(LINE_TABLES.contains(table) ? "line" : "polygon")
                    .count(count)
                    .hasHeight(TABLES_WITH_HEIGHT.contains(table))
                    .build());
        }
        // 全部表都查不到 = 数据库不可用，不是「部分降级」，必须 fail-fast。
        // 否则应用会「启动成功、接口 200、data 为空数组」，监控与调用方都无法察觉。
        if (failed == ALLOWED_TABLES.size()) {
            throw new IllegalStateException(
                    "全部 " + failed + " 个图层表的记录数查询均失败，数据库不可用，拒绝以空图层缓存启动");
        }
        if (failed > 0) {
            log.warn("图层元数据缓存初始化完成，共 {} 个图层，其中 {} 个 count 为 null（部分表不可用）",
                    layerCache.size(), failed);
        } else {
            log.info("图层元数据缓存初始化完成，共 {} 个图层", layerCache.size());
        }
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
