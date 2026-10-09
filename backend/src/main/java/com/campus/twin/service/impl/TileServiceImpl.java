package com.campus.twin.service.impl;

import com.campus.twin.mapper.TileMapper;
import com.campus.twin.service.SpatialService;
import com.campus.twin.service.TileService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

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
            // ST_AsMVT 是无 GROUP BY 的聚合，结果恒为 1 行；取首行即完整瓦片
            List<byte[]> rows = tileMapper.selectMvt(table, z, x, y);
            if (rows == null || rows.isEmpty()) {
                // 该瓦片范围内无要素：属正常情况，返回空瓦片
                return new byte[0];
            }
            byte[] mvt = rows.get(0);
            return mvt != null ? mvt : new byte[0];
        } catch (Exception e) {
            // 用 error 级别并保留堆栈：此前用 warn 静默吞掉异常，
            // 导致瓦片接口长期"HTTP 200 + 0 字节"却无人察觉
            log.error("生成 MVT 瓦片失败 table={}, z={}, x={}, y={}", table, z, x, y, e);
            return new byte[0];
        }
    }
}
