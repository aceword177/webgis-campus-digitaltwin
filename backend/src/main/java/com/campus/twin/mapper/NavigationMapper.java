package com.campus.twin.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

/**
 * 无人机导航 Mapper
 * 包含 pgr_astar 路径规划查询和空间查询
 */
@Mapper
public interface NavigationMapper {

    /**
     * pgr_astar 最短路径查询
     * 返回路径上的节点序列
     */
    @Select("SELECT seq, path_seq, node, edge, cost, agg_cost " +
            "FROM pgr_astar(" +
            "  'SELECT id, source, target, cost, x1, y1, x2, y2 FROM drone_nav_edge'," +
            "  #{startNodeId}, #{endNodeId}, directed := false" +
            ")")
    List<Map<String, Object>> findShortestPath(
            @Param("startNodeId") Integer startNodeId,
            @Param("endNodeId") Integer endNodeId);

    /**
     * 找离指定坐标最近的可飞行网格节点
     */
    @Select("SELECT id, lng, lat, ST_AsGeoJSON(geom) AS geom " +
            "FROM drone_nav_node " +
            "WHERE is_walkable = true " +
            "ORDER BY geom <-> ST_SetSRID(ST_MakePoint(#{lng}, #{lat}), 4326) " +
            "LIMIT 1")
    Map<String, Object> findNearestWalkableNode(
            @Param("lng") Double lng,
            @Param("lat") Double lat);

    /**
     * 根据节点ID列表获取节点坐标，并按路径顺序连接成 LineString
     * 同时计算总距离（geography 真实球面米，与无人机 haversine 推进口径一致）
     */
    @Select("SELECT " +
            "  ST_AsGeoJSON(ST_MakeLine(geom ORDER BY ordinality)) AS route_geojson, " +
            "  ROUND(ST_Length(ST_MakeLine(geom ORDER BY ordinality)::geography)::numeric, 2) AS distance_m " +
            "FROM drone_nav_node n " +
            "JOIN UNNEST(#{nodeIds}::int[]) WITH ORDINALITY AS t(id, ordinality) ON n.id = t.id")
    Map<String, Object> buildRouteFromNodes(@Param("nodeIds") String nodeIds);

    /**
     * 检测线段是否穿越限飞区
     */
    @Select("SELECT nfz.id, nfz.name, nfz.level " +
            "FROM no_fly_zone nfz " +
            "WHERE ST_Intersects(" +
            "  nfz.geom, " +
            "  ST_SetSRID(ST_MakeLine(" +
            "    ST_MakePoint(#{startLng}, #{startLat})," +
            "    ST_MakePoint(#{endLng}, #{endLat})" +
            "  ), 4326)" +
            ")")
    List<Map<String, Object>> checkLineCrossNoFlyZone(
            @Param("startLng") Double startLng,
            @Param("startLat") Double startLat,
            @Param("endLng") Double endLng,
            @Param("endLat") Double endLat);

    /**
     * 检测 A* 规划路径（途经的边集合）是否穿越限飞区
     * 返回穿越的限飞区列表（id/name/level），空列表表示路径已成功绕行
     */
    @Select("<script>" +
            "SELECT DISTINCT nfz.id, nfz.name, nfz.level " +
            "FROM no_fly_zone nfz " +
            "JOIN drone_nav_edge e ON ST_Intersects(nfz.geom, e.geom) " +
            "WHERE e.id IN " +
            "<foreach collection='edgeIds' item='eid' open='(' separator=',' close=')'>#{eid}</foreach>" +
            "</script>")
    List<Map<String, Object>> checkPathCrossNoFlyZone(@Param("edgeIds") List<Integer> edgeIds);

    /**
     * 由节点 id 序列拼出该段航线的 GeoJSON（LineString）。
     * 供食堂覆盖分析绘制"实际可达路径"使用。
     */
    @Select("SELECT ST_AsGeoJSON(ST_MakeLine(geom ORDER BY ordinality)) AS path_geojson " +
            "FROM drone_nav_node n " +
            "JOIN UNNEST(#{nodeIds}::int[]) WITH ORDINALITY AS t(id, ordinality) ON n.id = t.id")
    Map<String, Object> buildPathGeojson(@Param("nodeIds") String nodeIds);

    /**
     * 把多条实际航线缓冲后求并集，得到该档的"可达区"面（GeoJSON）。
     *
     * <p>为什么必须换成面：分档依据是 A* 的**实走距离**（沿 15m 栅格、会绕行限飞区），
     * 而圆是直线半径。两者数学上不等价，于是出现"圆里不含某宿舍，面板列表里却有它"
     * 的自相矛盾。用实际路径并集生成面后，图形与列表严格自洽。
     *
     * @param paths  单条 LineString 的 GeoJSON 列表（至少一条）
     * @param bufferM 线扩成面的缓冲半宽（米）
     */
    @Select("<script>" +
            "SELECT ST_AsGeoJSON(ST_Union(ARRAY[" +
            "<foreach collection='paths' item='p' separator=','>" +
            "ST_Buffer(ST_SetSRID(ST_GeomFromGeoJSON(#{p}), 4326)::geography, #{bufferM})::geometry" +
            "</foreach>" +
            "])) AS reach_geojson" +
            "</script>")
    Map<String, Object> buildReachPolygon(@Param("paths") List<String> paths,
                                          @Param("bufferM") double bufferM);
}