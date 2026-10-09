package com.campus.twin.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;

import java.util.List;
import java.util.Map;

/**
 * PostGIS ↔ Java 的 GeoJSON 取值工具。
 *
 * <p><b>为什么需要它</b>：项目里 {@code ST_AsGeoJSON(...) AS centroid} 的结果要经
 * MyBatis 的 {@code resultType=Map} 回到 Java。此时值的运行时类型取决于 JDBC 驱动
 * 对返回列类型的判定 —— 可能是 {@code String}（text 列），也可能是 {@code Map}
 * （已由某层反序列化）。此前各处写法不统一：
 * <ul>
 *   <li>{@code DroneServiceImpl} 直接 {@code (String) building.get("centroid")} 强转并静默
 *       {@code continue}；</li>
 *   <li>{@code RestaurantServiceImpl} 用 {@code Object} + 手工 Jackson 反序列化；</li>
 *   <li>{@code OrderServiceImpl} 做了 {@code instanceof Map} 分支但失败即抛异常。</li>
 * </ul>
 * 三种写法"目前都能跑"纯属巧合，任一处边界变化就会 {@code ClassCastException}。
 * 这里统一成一个防御式实现，供各服务复用。
 */
@Slf4j
public final class GeoJsonSupport {

    private GeoJsonSupport() {
    }

    /**
     * 从形如 {@code {"type":"Point","coordinates":[lng,lat]}} 的值中取出 [lng, lat]。
     *
     * @param value 可能是 GeoJSON 字符串、已解析的 Map，或 null
     * @return {@code double[]{lng, lat}}；无法解析时返回 {@code null}（不抛异常）
     */
    @SuppressWarnings("unchecked")
    public static double[] parsePoint(Object value, ObjectMapper objectMapper) {
        if (value == null) {
            return null;
        }
        try {
            Map<String, Object> geo;
            if (value instanceof Map) {
                geo = (Map<String, Object>) value;
            } else if (value instanceof String s) {
                if (s.isBlank()) {
                    return null;
                }
                geo = objectMapper.readValue(s, Map.class);
            } else {
                // 兜底：某些驱动可能给出 PGobject 等，按字符串再试一次
                geo = objectMapper.readValue(value.toString(), Map.class);
            }
            Object coords = geo.get("coordinates");
            if (coords instanceof List<?> list && list.size() >= 2) {
                Object lng = list.get(0);
                Object lat = list.get(1);
                if (lng instanceof Number n1 && lat instanceof Number n2) {
                    return new double[]{n1.doubleValue(), n2.doubleValue()};
                }
            }
        } catch (Exception e) {
            log.warn("解析 GeoJSON 点坐标失败: {}", e.getMessage());
        }
        return null;
    }

    /**
     * 从 {@code ST_AsGeoJSON(ST_Centroid(geom))} 的查询结果行中取质心坐标。
     *
     * @param row           {@code selectById} 之类的单行结果（含 {@code centroid} 键），可为 null
     * @param objectMapper  调用方的 Jackson 实例
     * @return {@code double[]{lng, lat}}；缺失或不可解析时返回 {@code null}
     */
    public static double[] parseCentroid(Map<String, Object> row, ObjectMapper objectMapper) {
        if (row == null) {
            return null;
        }
        return parsePoint(row.get("centroid"), objectMapper);
    }
}
