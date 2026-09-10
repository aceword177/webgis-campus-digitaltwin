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
     * 同时计算总距离
     */
    @Select("SELECT " +
            "  ST_AsGeoJSON(ST_MakeLine(geom ORDER BY ordinality)) AS route_geojson, " +
            "  ROUND(ST_Length(ST_Transform(ST_MakeLine(geom ORDER BY ordinality), 3857))::numeric, 2) AS distance_m " +
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
}