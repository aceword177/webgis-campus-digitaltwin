package com.campus.twin.service;

/**
 * MVT 矢量瓦片服务接口
 */
public interface TileService {

    /**
     * 生成 MVT 矢量瓦片
     *
     * @param table 表名
     * @param z     缩放级别
     * @param x     瓦片 X
     * @param y     瓦片 Y
     * @return MVT 二进制数据
     */
    byte[] getMvtTile(String table, Integer z, Integer x, Integer y);
}
