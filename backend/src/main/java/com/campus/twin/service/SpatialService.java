package com.campus.twin.service;

import com.campus.twin.dto.LayerMeta;

import java.util.List;
import java.util.Map;

/**
 * 空间查询服务接口
 */
public interface SpatialService {

    /**
     * 获取所有图层元数据
     */
    List<LayerMeta> getAllLayers();

    /**
     * 点选查询
     *
     * @param table 表名
     * @param lng   经度
     * @param lat   纬度
     */
    Map<String, Object> pointQuery(String table, Double lng, Double lat);

    /**
     * 缓冲区查询
     *
     * @param table  表名
     * @param lng    经度
     * @param lat    纬度
     * @param radius 半径（米）
     */
    List<Map<String, Object>> bufferQuery(String table, Double lng, Double lat, Double radius);

    /**
     * 获取整表 GeoJSON 数据
     *
     * @param table 表名
     */
    List<Map<String, Object>> getGeoJson(String table);

    /**
     * 根据 ID 查询要素详情
     *
     * @param table 表名
     * @param id    要素 ID
     */
    Map<String, Object> getById(String table, Integer id);

    /**
     * 获取校园边界和中心点
     */
    Map<String, Object> getCampusBounds();

    /**
     * 校验表名是否合法（防止 SQL 注入）
     */
    void validateTable(String table);
}
