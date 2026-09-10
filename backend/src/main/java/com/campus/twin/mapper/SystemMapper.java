package com.campus.twin.mapper;

import org.apache.ibatis.annotations.Update;

/**
 * 系统级数据维护 SQL（启动清理等）
 */
public interface SystemMapper {

    /**
     * 清理历史脏订单：分配超过 1 天仍未送达的 delivering 订单 → delivered（已完成）
     */
    @Update("UPDATE delivery_order SET status='delivered', deliver_time=now() " +
            "WHERE status='delivering' AND assign_time < now() - interval '1 day'")
    int completeStaleOrders();

    /**
     * 清理历史脏订单：分配超过 1 天仍停留在 assigned 的订单 → cancelled（已分配未起飞，视为作废）
     * 释放被占用的无人机，避免"全局进行中订单数"被脏数据卡满导致自动补单停摆
     */
    @Update("UPDATE delivery_order SET status='cancelled', remark='系统清理: 历史未起飞订单' " +
            "WHERE status='assigned' AND assign_time < now() - interval '1 day'")
    int completeStaleAssignedOrders();

    /**
     * 同步已完成订单的航线状态为 completed（避免仍以 flying 显示在地图上）
     */
    @Update("UPDATE flight_route SET status='completed' " +
            "WHERE status <> 'completed' AND order_id IN " +
            "(SELECT id FROM delivery_order WHERE status='delivered')")
    int completeStaleRoutes();

    /**
     * 状态修正：无配送中订单但状态为 delivering 的无人机 → idle
     */
    @Update("UPDATE drone SET status='idle', last_update_time=now() " +
            "WHERE status='delivering' AND NOT EXISTS " +
            "(SELECT 1 FROM delivery_order o WHERE o.drone_id = drone.id AND o.status='delivering')")
    int resetStaleDrones();
}
