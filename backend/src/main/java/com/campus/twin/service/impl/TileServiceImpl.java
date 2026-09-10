package com.campus.twin.service.impl;

import com.campus.twin.mapper.TileMapper;
import com.campus.twin.service.SpatialService;
import com.campus.twin.service.TileService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * MVT 矢量瓦片服务实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TileServiceImpl implements TileService {

    private final TileMapper tileMapper;
    private final SpatialService spatialService;

    @Override
    public byte[] getMvtTile(String table, Integer z, Integer x, Integer y) {
        spatialService.validateTable(table);

        // 缩放级别校验（Web Mercator 瓦片有效范围 0-22）
        if (z < 0 || z > 22 || x < 0 || y < 0) {
            return new byte[0];
        }

        try {
            byte[] mvt = tileMapper.selectMvt(table, z, x, y);
            return mvt != null ? mvt : new byte[0];
        } catch (Exception e) {
            log.warn("生成 MVT 瓦片失败 table={}, z={}, x={}, y={}, error={}",
                    table, z, x, y, e.getMessage());
            return new byte[0];
        }
    }
}
