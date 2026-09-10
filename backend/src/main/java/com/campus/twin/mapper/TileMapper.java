package com.campus.twin.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * MVT 矢量瓦片 Mapper
 * 利用 PostGIS 原生 ST_AsMVT / ST_AsMVTGeom 函数生成矢量瓦片
 */
@Mapper
public interface TileMapper {

    /**
     * 生成指定表的 MVT 矢量瓦片
     *
     * @param table 表名
     * @param z     缩放级别
     * @param x     瓦片 X 坐标
     * @param y     瓦片 Y 坐标
     * @return MVT 二进制数据（protobuf 格式）
     */
    byte[] selectMvt(@Param("table") String table,
                     @Param("z") Integer z,
                     @Param("x") Integer x,
                     @Param("y") Integer y);
}
