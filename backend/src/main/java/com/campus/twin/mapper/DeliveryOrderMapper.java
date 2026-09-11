package com.campus.twin.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.campus.twin.entity.DeliveryOrder;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface DeliveryOrderMapper extends BaseMapper<DeliveryOrder> {

    /**
     * 行级加锁查询订单（FOR UPDATE，需在事务内使用）
     * 用于派单并发控制：锁定订单行直至事务提交，防止同一订单被重复派单
     */
    @Select("SELECT * FROM delivery_order WHERE id = #{id} FOR UPDATE")
    DeliveryOrder selectByIdForUpdate(@Param("id") Integer id);
}
