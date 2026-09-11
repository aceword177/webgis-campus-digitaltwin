package com.campus.twin.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.campus.twin.entity.Drone;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface DroneMapper extends BaseMapper<Drone> {

    /**
     * 行级加锁查询指定空闲无人机（FOR UPDATE，需在事务内使用）
     * 返回 null 表示不存在或不空闲；锁持有至事务提交，防止同一无人机被重复派单
     */
    @Select("SELECT * FROM drone WHERE id = #{id} AND status = 'idle' FOR UPDATE")
    Drone selectIdleByIdForUpdate(@Param("id") Integer id);

    /**
     * 行级加锁挑选电量最高的空闲无人机（FOR UPDATE，需在事务内使用）
     * 与手动派单、自动续派共用同一锁路径，消除并发双派
     */
    @Select("SELECT * FROM drone WHERE status = 'idle' AND battery_pct > 30 " +
            "ORDER BY battery_pct DESC LIMIT 1 FOR UPDATE")
    Drone selectAvailableForUpdate();
}
