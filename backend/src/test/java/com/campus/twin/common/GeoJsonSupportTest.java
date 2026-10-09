package com.campus.twin.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * {@link GeoJsonSupport} 单元测试。
 *
 * <p>这组测试锁住一个**真实踩过的坑**：{@code ST_AsGeoJSON(...) AS centroid} 经
 * MyBatis {@code resultType=Map} 回到 Java 时，值的运行时类型并不确定
 * （可能是 String，也可能是已反序列化的 Map）。此前三个服务各写一套解析，
 * 其中一处直接 {@code (String)} 强转，边界一变就 ClassCastException。
 */
class GeoJsonSupportTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    @DisplayName("解析 GeoJSON 字符串形式的点坐标")
    void parsesPointFromString() {
        double[] c = GeoJsonSupport.parsePoint(
                "{\"type\":\"Point\",\"coordinates\":[114.470403771,37.983181951]}", mapper);
        assertArrayEquals(new double[]{114.470403771, 37.983181951}, c, 1e-9);
    }

    @Test
    @DisplayName("解析已反序列化的 Map 形式（驱动直接给出 Map 的场景）")
    void parsesPointFromMap() {
        Map<String, Object> geo = Map.of("type", "Point", "coordinates", List.of(114.47, 37.98));
        double[] c = GeoJsonSupport.parsePoint(geo, mapper);
        assertArrayEquals(new double[]{114.47, 37.98}, c, 1e-9);
    }

    @Test
    @DisplayName("坐标元素为整数时也能正确转成 double（List<Integer> 场景）")
    void parsesIntegerCoordinates() {
        double[] c = GeoJsonSupport.parsePoint(
                Map.of("type", "Point", "coordinates", List.of(114, 38)), mapper);
        assertArrayEquals(new double[]{114.0, 38.0}, c, 1e-9);
    }

    @Test
    @DisplayName("从查询结果行里取 centroid")
    void parsesCentroidFromRow() {
        Map<String, Object> row = new HashMap<>();
        row.put("id", 4);
        row.put("centroid", "{\"type\":\"Point\",\"coordinates\":[114.4704,37.9832]}");
        assertArrayEquals(new double[]{114.4704, 37.9832},
                GeoJsonSupport.parseCentroid(row, mapper), 1e-9);
    }

    @Test
    @DisplayName("非法输入一律返回 null，不抛异常（避免批量加载时整批崩掉）")
    void returnsNullForBadInput() {
        assertNull(GeoJsonSupport.parsePoint(null, mapper));
        assertNull(GeoJsonSupport.parsePoint("", mapper));
        assertNull(GeoJsonSupport.parsePoint("not json", mapper));
        assertNull(GeoJsonSupport.parsePoint("{\"type\":\"Point\"}", mapper));            // 无 coordinates
        assertNull(GeoJsonSupport.parsePoint("{\"coordinates\":[114.47]}", mapper));      // 只有 1 个分量
        assertNull(GeoJsonSupport.parseCentroid(null, mapper));
        assertNull(GeoJsonSupport.parseCentroid(new HashMap<>(), mapper));                // 无 centroid 键
    }

    @Test
    @DisplayName("Polygon 的 coordinates 不应被误当作点解析")
    void doesNotMistakePolygonForPoint() {
        String polygon = "{\"type\":\"Polygon\",\"coordinates\":[[[114.47,37.98],[114.48,37.98],"
                + "[114.48,37.99],[114.47,37.98]]]}";
        // 第一个元素是数组而非数字，必须返回 null 而不是抛出或给出错误坐标
        assertNull(GeoJsonSupport.parsePoint(polygon, mapper));
    }
}
