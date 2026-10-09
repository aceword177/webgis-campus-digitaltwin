package com.campus.twin.mapper;

import org.apache.ibatis.annotations.Update;

/**
 * 系统级数据维护 SQL（启动清理等）
 *
 * <p>注意：这些语句会**改写业务数据**，因此都被 {@code campus.cleanup.enabled}
 * 开关统一管控（见 {@link com.campus.twin.config.DataCleanupRunner}）。
 * 编写原则：
 * <ul>
 *   <li>不覆写用户填写的自由文本字段（如 {@code remark}）；</li>
 *   <li>不伪造时间戳（如把 {@code deliver_time} 设成 now()）——那会污染
 *       {@code /api/order/stats} 的平均配送时长与"今日已送达"；</li>
 *   <li>只做"状态归位"这类可逆、语义明确的修正。</li>
 * </ul>
 */
public interface SystemMapper {

    /**
     * 清理历史脏订单：分配超过 1 天仍未送达的 delivering 订单 → cancelled。
     *
     * <p>为什么不改成 delivered：那等于**伪造一次从未发生的送达**，还会写入假的
     * deliver_time，直接污染配送时长与送达率统计。这类订单的正确归宿是"作废"。
     */
    @Update("UPDATE delivery_order SET status='cancelled' " +
            "WHERE status='delivering' AND assign_time < now() - interval '1 day'")
    int completeStaleOrders();

    /**
     * 清理历史脏订单：分配超过 1 天仍停留在 assigned 的订单 → cancelled
     * （已分配未起飞，视为作废），释放被占用的无人机，
     * 避免"全局进行中订单数"被脏数据卡满导致自动补单停摆。
     *
     * <p><b>不覆写 remark</b>：该字段是用户填写的备注（如"少辣"），
     * 旧实现直接 SET remark='系统清理: 历史未起飞订单' 会造成不可恢复的数据丢失。
     * 现在只在 remark 为空时填一个中性说明，非空则原样保留。
     */
    @Update("UPDATE delivery_order " +
            "SET status='cancelled', " +
            "    remark = COALESCE(NULLIF(remark, ''), '系统清理: 历史未起飞订单') " +
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
