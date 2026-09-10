package com.campus.twin.service;

import com.campus.twin.dto.RoutePlanRequest;
import com.campus.twin.dto.RoutePlanResponse;
import com.campus.twin.entity.FlightRoute;

import java.util.List;

public interface RouteService {

    /**
     * 规划航线（核心算法：pgr_astar 最短路径 + 限飞区避让）
     */
    RoutePlanResponse plan(RoutePlanRequest request);

    FlightRoute getById(Integer id);

    FlightRoute getByOrderId(Integer orderId);

    /** 当前飞行中的航线列表 */
    List<FlightRoute> getActiveRoutes();

    /** 保存航线到数据库 */
    FlightRoute saveRoute(Integer orderId, Integer droneId, RoutePlanResponse plan);
}
