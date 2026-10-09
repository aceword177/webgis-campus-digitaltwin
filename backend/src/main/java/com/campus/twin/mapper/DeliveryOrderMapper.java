package com.campus.twin.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.campus.twin.entity.DeliveryOrder;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

@Mapper
public interface DeliveryOrderMapper extends BaseMapper<DeliveryOrder> {

    /**
     * 行级加锁查询订单（FOR UPDATE，需在事务内使用）
     * 用于派单并发控制：锁定订单行直至事务提交，防止同一订单被重复派单
     */
    @Select("SELECT * FROM delivery_order WHERE id = #{id} FOR UPDATE")
    DeliveryOrder selectByIdForUpdate(@Param("id") Integer id);

    /**
     * 按状态聚合订单数。
     *
     * <p>用于配送统计：{@code status_count} 是**全量**口径，{@code today_count} 是
     * 「按 create_time 落在今天」的口径，两者一次查询取回，
     * 避免把整张 delivery_order 表读进内存再聚合。
     */
    @Select("SELECT status, COUNT(*) AS status_count, " +
            "COUNT(*) FILTER (WHERE create_time >= CURRENT_DATE) AS today_count " +
            "FROM delivery_order GROUP BY status")
    List<Map<String, Object>> selectStatusCounts();

    /**
     * 已送达订单的平均配送时长（分钟）。
     * 只在数据库侧聚合，不把订单行搬回应用层。
     */
    @Select("SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (deliver_time - create_time)) / 60.0), 0) " +
            "FROM delivery_order " +
            "WHERE status = 'delivered' AND create_time IS NOT NULL AND deliver_time IS NOT NULL")
    Double selectAvgDeliveryMinutes();

    /**
     * 各餐厅订单量（全量口径）。餐厅名在 SQL 侧 JOIN 出来，省去二次查询。
     */
    @Select("SELECT r.name AS restaurant_name, COUNT(*) AS order_count " +
            "FROM delivery_order o JOIN restaurant r ON r.id = o.restaurant_id " +
            "GROUP BY r.name ORDER BY order_count DESC")
    List<Map<String, Object>> selectOrderCountByRestaurant();
}
