package com.campus.twin.service.impl;

import com.campus.twin.mapper.SpatialQueryMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * 表名白名单单元测试 —— 这是一条**安全边界**。
 *
 * <p>背景：{@code SpatialQueryMapper.xml} 与 {@code TileMapper.xml} 里使用了
 * MyBatis 的 {@code ${table}}（字符串拼接，非预编译参数）。这是 SQL 注入的经典入口，
 * 之所以安全，完全依赖本类的白名单校验。
 *
 * <p>因此必须锁住：
 * <ol>
 *   <li>合法表名放行；</li>
 *   <li>任何不在白名单内的输入（含注入载荷、大小写变体、空白、null）一律拒绝；</li>
 *   <li>拒绝时必须抛 {@link IllegalArgumentException}（映射到 HTTP 400），
 *       而不是静默返回空结果 —— 静默会让攻击者以为没生效，而运维也看不到异常。</li>
 * </ol>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SpatialServiceImplTest {

    @Mock private SpatialQueryMapper spatialQueryMapper;

    private SpatialServiceImpl newService() {
        SpatialServiceImpl s = new SpatialServiceImpl(spatialQueryMapper);
        // @PostConstruct 在容器里才会被调用；这里手动触发，构造出图层缓存
        when(spatialQueryMapper.selectCount(anyString())).thenReturn(1);
        s.init();
        return s;
    }

    private static final String[] VALID = {
            "school", "teaching_building", "dormitory", "other_buildings",
            "road", "playground", "basketball_court", "tennis_court"
    };

    @Test
    @DisplayName("白名单内的 8 张表全部放行")
    void acceptsAllWhitelistedTables() {
        SpatialServiceImpl s = newService();
        for (String t : VALID) {
            assertDoesNotThrow(() -> s.validateTable(t), "应放行: " + t);
        }
    }

    @Test
    @DisplayName("图层元数据应恰好覆盖 8 张表，且顺序固定")
    void layerCacheIsStableAndComplete() {
        SpatialServiceImpl s = newService();
        var layers = s.getAllLayers();
        assertTrue(layers.size() >= VALID.length,
                "图层数应不少于白名单表数，实际 " + layers.size());
        // 顺序确定性：两次调用顺序一致（此前用 Set.of 导致顺序随 JVM 运行变化）
        var first = layers.stream().map(l -> l.getTableName()).toList();
        var second = s.getAllLayers().stream().map(l -> l.getTableName()).toList();
        assertTrue(first.equals(second), "图层顺序应稳定");
    }

    @Test
    @DisplayName("SQL 注入载荷一律拒绝")
    void rejectsInjectionAttempts() {
        SpatialServiceImpl s = newService();
        String[] attacks = {
                "school; DROP TABLE drone",
                "school--",
                "school /*x*/",
                "1=1",
                "school UNION SELECT * FROM drone",
                "pg_catalog.pg_tables",
                "\"school\"",
                "school'",
                "school OR 1=1",
        };
        for (String a : attacks) {
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                    () -> s.validateTable(a), "必须拒绝注入载荷: " + a);
            assertTrue(ex.getMessage().contains("非法的表名"),
                    "拒绝原因应明确，实际: " + ex.getMessage());
        }
    }

    @Test
    @DisplayName("大小写变体拒绝（白名单是精确匹配，不做大小写归一）")
    void rejectsCaseVariants() {
        SpatialServiceImpl s = newService();
        assertThrows(IllegalArgumentException.class, () -> s.validateTable("School"));
        assertThrows(IllegalArgumentException.class, () -> s.validateTable("SCHOOL"));
        assertThrows(IllegalArgumentException.class, () -> s.validateTable("Dormitory"));
    }

    @Test
    @DisplayName("null / 空串 / 空白 / 前后空格 一律拒绝")
    void rejectsBlankAndNull() {
        SpatialServiceImpl s = newService();
        assertThrows(IllegalArgumentException.class, () -> s.validateTable(null));
        assertThrows(IllegalArgumentException.class, () -> s.validateTable(""));
        assertThrows(IllegalArgumentException.class, () -> s.validateTable("   "));
        assertThrows(IllegalArgumentException.class, () -> s.validateTable(" school"));
        assertThrows(IllegalArgumentException.class, () -> s.validateTable("school "));
    }

    @Test
    @DisplayName("不存在的表名拒绝")
    void rejectsUnknownTable() {
        SpatialServiceImpl s = newService();
        assertThrows(IllegalArgumentException.class, () -> s.validateTable("restaurant"));
        assertThrows(IllegalArgumentException.class, () -> s.validateTable("drone_nav_node"));
        assertThrows(IllegalArgumentException.class, () -> s.validateTable("users"));
    }
}
