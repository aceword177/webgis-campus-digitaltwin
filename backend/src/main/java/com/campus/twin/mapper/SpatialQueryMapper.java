package com.campus.twin.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Map;

/**
 * 通用空间查询 Mapper
 * 所有空间查询方法通过表名动态切换查询目标表
 */
@Mapper
public interface SpatialQueryMapper {

    /**
     * 点选查询 - 根据经纬度查询落在哪个要素上
     *
     * @param table 表名
     * @param lng   经度
     * @param lat   纬度
     * @return 匹配的要素列表（通常只有一个）
     */
    List<Map<String, Object>> selectByPoint(@Param("table") String table,
                                              @Param("lng") Double lng,
                                              @Param("lat") Double lat);

    /**
     * 缓冲区查询 - 查询指定半径范围内的所有要素
     *
     * @param table  表名
     * @param lng    经度
     * @param lat    纬度
     * @param radius 半径（米）
     * @return 要素列表（含距离，按距离升序）
     */
    List<Map<String, Object>> selectByBuffer(@Param("table") String table,
                                               @Param("lng") Double lng,
                                               @Param("lat") Double lat,
                                               @Param("radius") Double radius);

    /**
     * 查询整表 GeoJSON 格式数据
     *
     * @param table 表名
     * @return 要素列表（geom 为 GeoJSON 字符串）
     */
    List<Map<String, Object>> selectAllGeoJson(@Param("table") String table);

    /**
     * 根据 ID 查询单个要素
     *
     * @param table 表名
     * @param id    要素 ID
     * @return 要素详情
     */
    Map<String, Object> selectById(@Param("table") String table, @Param("id") Integer id);

    /**
     * 计算点到指定要素的距离（米，投影坐标系下计算）
     *
     * @param table 表名
     * @param id    要素 ID
     * @param lng   点经度
     * @param lat   点纬度
     * @return 距离（米），要素不存在时为 null
     */
    Double selectDistanceToFeature(@Param("table") String table,
                                   @Param("id") Integer id,
                                   @Param("lng") Double lng,
                                   @Param("lat") Double lat);

    /**
     * 查询表的记录数
     *
     * @param table 表名
     * @return 记录数
     */
    Integer selectCount(@Param("table") String table);

    /**
     * 查询校园边界范围（从 school 表获取）
     *
     * @return 边界信息（minx, miny, maxx, maxy, center_lng, center_lat）
     */
    Map<String, Object> selectCampusBounds();

    /**
     * 统计所有建筑的总面积和总数
     *
     * @return 统计结果
     */
    Map<String, Object> selectBuildingStats();

    /**
     * 统计道路总长度
     *
     * @return 道路总长度（度，需转换）
     */
    Map<String, Object> selectRoadStats();
}
