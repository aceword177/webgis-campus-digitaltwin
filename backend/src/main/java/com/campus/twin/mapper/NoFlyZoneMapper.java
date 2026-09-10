package com.campus.twin.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.campus.twin.entity.NoFlyZone;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface NoFlyZoneMapper extends BaseMapper<NoFlyZone> {

    /**
     * 查询限飞区列表，geom 字段转换为 GeoJSON 字符串
     */
    @Select("SELECT id, name, source_table, source_id, ST_AsGeoJSON(geom) AS geom, level, reason, create_time " +
            "FROM no_fly_zone " +
            "WHERE (CAST(#{level} AS text) IS NULL OR level = CAST(#{level} AS text)) " +
            "ORDER BY id ASC")
    List<NoFlyZone> selectListWithGeoJson(@Param("level") String level);
}
