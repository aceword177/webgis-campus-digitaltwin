package com.campus.twin.dto;

import lombok.Builder;
import lombok.Data;

import java.io.Serializable;
import java.util.List;

@Data
@Builder
public class TierCoverageVO implements Serializable {

    /** 分档时长（秒）：30 / 60 / 90 */
    private Integer seconds;

    /**
     * @deprecated 直线半径（= seconds × 飞行速度）。
     * 分档依据是 A* 实走距离，与直线半径不等价，继续用它画圆会与
     * {@link #dormitories} 列表自相矛盾。新前端应改用 {@link #reachGeojson}。
     * 字段暂时保留仅为兼容旧版本前端。
     */
    @Deprecated
    private Double radius;

    /** 该档实际覆盖的宿舍（按实走时间升序） */
    private List<DormitoryCoverageVO> dormitories;

    /**
     * 该档的"可达区"面（GeoJSON Polygon/MultiPolygon 字符串）。
     * 由该档覆盖宿舍的实际 A* 路径按固定宽度缓冲而成，
     * 与 {@link #dormitories} 严格自洽——面上覆盖到的宿舍就是列表里的宿舍。
     */
    private String reachGeojson;

    /** 该档覆盖宿舍中的最远实走距离（米），用于图例文案 */
    private Double maxDistanceM;
}
