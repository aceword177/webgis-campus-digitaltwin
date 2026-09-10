package com.campus.twin.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.campus.twin.entity.FlightRoute;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface FlightRouteMapper extends BaseMapper<FlightRoute> {

    /**
     * 插入航线，route_geom 为 GeoJSON 字符串，通过 ST_GeomFromGeoJSON 转 geometry
     */
    @Insert("INSERT INTO flight_route (order_id, drone_id, start_lng, start_lat, end_lng, end_lat, route_geom, " +
            "waypoints_count, distance_m, estimated_seconds, altitude_m, status, create_time) " +
            "VALUES (#{orderId}, #{droneId}, #{startLng}, #{startLat}, #{endLng}, #{endLat}, " +
            "ST_GeomFromGeoJSON(#{routeGeom}), #{waypointsCount}, #{distanceM}, #{estimatedSeconds}, " +
            "#{altitudeM}, #{status}, #{createTime})")
    int insertWithGeoJson(FlightRoute route);

    /**
     * 根据ID查询航线，route_geom 转换为 GeoJSON
     */
    @Select("SELECT id, order_id, drone_id, start_lng, start_lat, end_lng, end_lat, " +
            "ST_AsGeoJSON(route_geom) AS route_geom, waypoints_count, distance_m, estimated_seconds, " +
            "altitude_m, status, create_time FROM flight_route WHERE id = #{id}")
    FlightRoute selectByIdWithGeoJson(@Param("id") Integer id);

    /**
     * 根据订单ID查询航线，route_geom 转换为 GeoJSON
     */
    @Select("SELECT id, order_id, drone_id, start_lng, start_lat, end_lng, end_lat, " +
            "ST_AsGeoJSON(route_geom) AS route_geom, waypoints_count, distance_m, estimated_seconds, " +
            "altitude_m, status, create_time FROM flight_route WHERE order_id = #{orderId} LIMIT 1")
    FlightRoute selectByOrderIdWithGeoJson(@Param("orderId") Integer orderId);

    /**
     * 查询飞行中的航线列表，route_geom 转换为 GeoJSON
     */
    @Select("SELECT id, order_id, drone_id, start_lng, start_lat, end_lng, end_lat, " +
            "ST_AsGeoJSON(route_geom) AS route_geom, waypoints_count, distance_m, estimated_seconds, " +
            "altitude_m, status, create_time FROM flight_route WHERE status = #{status} ORDER BY id ASC")
    List<FlightRoute> selectByStatusWithGeoJson(@Param("status") String status);
}
