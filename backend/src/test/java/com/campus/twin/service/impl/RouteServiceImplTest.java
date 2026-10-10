package com.campus.twin.service.impl;

import com.campus.twin.dto.RoutePlanRequest;
import com.campus.twin.dto.RoutePlanResponse;
import com.campus.twin.mapper.FlightRouteMapper;
import com.campus.twin.mapper.NavigationMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * 航线规划单元测试（pgr_astar 结果的加工逻辑）。
 *
 * <p>锁住的不变量：
 * <ol>
 *   <li><b>预计时长口径</b>：{@code ceil(距离 / 5 m/s)}，必须与无人机实时推进
 *       使用的速度常量一致 —— 两边漂移会导致"自动确认送达"在无人机还没到时就触发；</li>
 *   <li><b>起终点过近/不可达必须报错</b>，不能让空航线流到 saveRoute 里越界崩溃
 *       （这是修过的真实 bug）；</li>
 *   <li><b>绕行判定逻辑</b>：只有"直线穿越限飞区 且 规划路径不再穿越"才算成功避让。</li>
 * </ol>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RouteServiceImplTest {

    @Mock private NavigationMapper navigationMapper;
    @Mock private FlightRouteMapper flightRouteMapper;

    /**
     * 这里刻意注入**真实的** ObjectMapper，而不是 mock。
     *
     * 本类要验证的是"从 route_geojson 解析航点"这一步的真实行为；
     * 若把 ObjectMapper mock 掉，解析会静默返回空 Map，
     * 于是所有用例都会走到"航点不足"分支 —— 测不到真正想测的逻辑。
     */
    private final ObjectMapper realObjectMapper = new ObjectMapper();

    private RouteServiceImpl service;

    @org.junit.jupiter.api.BeforeEach
    void initService() {
        service = new RouteServiceImpl(navigationMapper, flightRouteMapper, realObjectMapper);
    }

    /** 用 n 个航点拼一条 LineString，长度由 lineLengthM 指定 */
    private String lineString(int n) {
        StringBuilder sb = new StringBuilder("{\"type\":\"LineString\",\"coordinates\":[");
        for (int i = 0; i < n; i++) {
            if (i > 0) sb.append(',');
            sb.append('[').append(114.46 + i * 0.0001).append(',').append(37.98 + i * 0.0001).append(']');
        }
        return sb.append("]}").toString();
    }

    private Map<String, Object> node(int id) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        return m;
    }

    private List<Map<String, Object>> path(int... nodeIds) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (int i = 0; i < nodeIds.length; i++) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("seq", i + 1);
            m.put("path_seq", i + 1);
            m.put("node", nodeIds[i]);
            m.put("edge", i == 0 ? -1 : 100 + i);   // 起点无入边，edge=-1
            m.put("cost", 1.0);
            m.put("agg_cost", (double) i);
            list.add(m);
        }
        return list;
    }

    private void stubCommon(int startNode, int endNode, List<Map<String, Object>> pathResult,
                            String routeGeojson, double distanceM) {
        when(navigationMapper.findNearestWalkableNode(any(), any()))
                .thenReturn(node(startNode), node(endNode));
        when(navigationMapper.findShortestPath(anyInt(), anyInt())).thenReturn(pathResult);
        when(navigationMapper.buildRouteFromNodes(anyString())).thenReturn(
                Map.of("route_geojson", routeGeojson, "distance_m", distanceM));
        when(navigationMapper.checkLineCrossNoFlyZone(any(), any(), any(), any()))
                .thenReturn(List.of());
    }

    private RoutePlanRequest request() {
        RoutePlanRequest r = new RoutePlanRequest();
        r.setStartLng(114.4704);
        r.setStartLat(37.9832);
        r.setEndLng(114.4683);
        r.setEndLat(37.9842);
        r.setAltitude(50.0);
        return r;
    }

    @Test
    @DisplayName("预计时长 = ceil(距离 / 5m/s)，与无人机推进速度同口径")
    void estimatedSecondsMatchesSpeedConstant() {
        stubCommon(1, 2, path(1, 2, 3), lineString(3), 250.0);

        RoutePlanResponse resp = service.plan(request());

        assertEquals(250.0, resp.getDistanceM(), 1e-9);
        // 250 / 5 = 50
        assertEquals(50, resp.getEstimatedSeconds());
        assertEquals(3, resp.getWaypointsCount());
        assertEquals(1, resp.getStartNodeId());
        assertEquals(2, resp.getEndNodeId());
    }

    @Test
    @DisplayName("预计时长向上取整：251m → 51s（不能截断成 50，否则会早到 1 秒）")
    void estimatedSecondsRoundsUp() {
        stubCommon(1, 2, path(1, 2), lineString(2), 251.0);
        assertEquals(51, service.plan(request()).getEstimatedSeconds());
    }

    @Test
    @DisplayName("起终点过近/不可达（route_geojson 为空）→ 抛异常，不返回空航线")
    void rejectsEmptyRoute() {
        when(navigationMapper.findNearestWalkableNode(any(), any()))
                .thenReturn(node(1), node(1));   // 起终点同一个节点
        when(navigationMapper.findShortestPath(anyInt(), anyInt())).thenReturn(path(1));
        when(navigationMapper.buildRouteFromNodes(anyString()))
                .thenReturn(Map.of());           // 没有 route_geojson

        RuntimeException ex = assertThrows(RuntimeException.class, () -> service.plan(request()));
        assertTrue(ex.getMessage().contains("过近") || ex.getMessage().contains("不可达"),
                "错误信息应说明原因，实际: " + ex.getMessage());
    }

    @Test
    @DisplayName("航点不足 2 个 → 抛异常（防止 saveRoute 里 waypoints[0] 越界）")
    void rejectsSingleWaypoint() {
        stubCommon(1, 2, path(1, 2), lineString(1), 10.0);
        RuntimeException ex = assertThrows(RuntimeException.class, () -> service.plan(request()));
        assertTrue(ex.getMessage().contains("航点") || ex.getMessage().contains("过近"),
                "错误信息应说明原因，实际: " + ex.getMessage());
    }

    @Test
    @DisplayName("起点附近无可飞行节点 → 抛异常")
    void rejectsWhenNoStartNode() {
        when(navigationMapper.findNearestWalkableNode(any(), any())).thenReturn(null);
        assertThrows(RuntimeException.class, () -> service.plan(request()));
    }

    @Test
    @DisplayName("A* 无解 → 抛异常")
    void rejectsWhenNoPath() {
        when(navigationMapper.findNearestWalkableNode(any(), any())).thenReturn(node(1), node(2));
        when(navigationMapper.findShortestPath(anyInt(), anyInt())).thenReturn(List.of());
        assertThrows(RuntimeException.class, () -> service.plan(request()));
    }

    @Test
    @DisplayName("直线未穿越限飞区 → 三个标志位均为 false（不虚报避让成功）")
    void noCrossingMeansNoAvoidanceClaimed() {
        stubCommon(1, 2, path(1, 2), lineString(2), 100.0);

        RoutePlanResponse resp = service.plan(request());

        assertFalse(resp.getStraightLineCrossZone(), "直线未穿区");
        assertFalse(resp.getRouteStillCrossZone(), "路径也未穿区");
        assertFalse(resp.getAvoidedNoFlyZone(), "既然没穿，就不能声称'成功避让'");
    }

    @Test
    @DisplayName("直线穿越但规划路径不穿越 → avoidedNoFlyZone = true")
    void claimsAvoidanceOnlyWhenPathIsClear() {
        stubCommon(1, 2, path(1, 2, 3), lineString(3), 300.0);
        when(navigationMapper.checkLineCrossNoFlyZone(any(), any(), any(), any()))
                .thenReturn(List.of(Map.of("id", 1, "name", "操场", "level", "strict")));
        when(navigationMapper.checkPathCrossNoFlyZone(any())).thenReturn(List.of());

        RoutePlanResponse resp = service.plan(request());

        assertTrue(resp.getStraightLineCrossZone(), "直线确实穿区");
        assertFalse(resp.getRouteStillCrossZone(), "规划路径已绕开");
        assertTrue(resp.getAvoidedNoFlyZone(), "应判定为成功避让");
        assertEquals(1, resp.getCrossedZones().size(), "应返回穿越的限飞区明细");
    }

    @Test
    @DisplayName("直线与规划路径都穿越 → 不得声称避让成功（诚实报告失败）")
    void doesNotClaimAvoidanceWhenPathStillCrosses() {
        stubCommon(1, 2, path(1, 2, 3), lineString(3), 300.0);
        when(navigationMapper.checkLineCrossNoFlyZone(any(), any(), any(), any()))
                .thenReturn(List.of(Map.of("id", 1, "name", "操场", "level", "strict")));
        when(navigationMapper.checkPathCrossNoFlyZone(any()))
                .thenReturn(List.of(Map.of("id", 1, "name", "操场", "level", "strict")));

        RoutePlanResponse resp = service.plan(request());

        assertTrue(resp.getRouteStillCrossZone(), "路径仍穿区");
        assertFalse(resp.getAvoidedNoFlyZone(), "不得谎报绕行成功");
    }

    @Test
    @DisplayName("height 缺省时 altitude 回落默认 50m，不抛 NPE")
    void altitudeFallsBackWhenNull() {
        stubCommon(1, 2, path(1, 2), lineString(2), 100.0);
        RoutePlanRequest req = request();
        req.setAltitude(null);   // 显式置空（JSON 传 null 的情形）

        assertEquals(50.0, service.plan(req).getAltitudeM(), 1e-9,
                "altitude 为空时应回落到 50m，而不是拆箱 NPE");
    }

    // ============================================================
    // 绕行对比（直线 vs 规划路径）—— 用于前端展示「A* 为避让多飞了多少」
    // ============================================================

    @Test
    @DisplayName("直线距离与 PostGIS ::geography 同口径（球面），可用作绕行比较的基准")
    void straightDistanceMatchesPostgisGeography() {
        stubCommon(1, 2, path(1, 2, 3), lineString(3), 300.0);

        RoutePlanResponse resp = service.plan(request());   // 起终点见 request()

        // 该起终点对的 PostGIS 值：
        //   SELECT ST_Distance(ST_SetSRID(ST_MakePoint(114.4704,37.9832),4326)::geography,
        //                      ST_SetSRID(ST_MakePoint(114.4683,37.9842),4326)::geography);
        //   -> 215.305 m
        // haversine 用球面半径 6371000，与 PostGIS geography 同为球面口径，
        // 允许 1m 内的差异；超出即说明两边口径漂移了。
        assertEquals(215.305, resp.getStraightDistanceM(), 1.0,
                "直线距离应与 PostGIS ::geography 一致（同为球面口径）");
    }

    @Test
    @DisplayName("绕行增量 = 规划距离 - 直线距离；绕行比例同步给出")
    void detourIsDifferenceBetweenPathAndStraightLine() {
        stubCommon(1, 2, path(1, 2, 3), lineString(3), 365.3);

        RoutePlanResponse resp = service.plan(request());

        double straight = resp.getStraightDistanceM();
        assertEquals(365.3 - straight, resp.getDetourM(), 1e-6,
                "绕行增量应为两距离之差");
        assertEquals(resp.getDetourM() / straight, resp.getDetourRatio(), 1e-9,
                "绕行比例应为 增量 / 直线距离");
        assertTrue(resp.getDetourM() > 100, "本例绕行增量应明显大于 100m");
    }

    @Test
    @DisplayName("起终点几乎重合时绕行比例置 null，避免出现无意义的巨大比值")
    void detourRatioIsNullWhenStraightDistanceIsNegligible() {
        stubCommon(1, 2, path(1, 2, 3), lineString(3), 120.0);
        RoutePlanRequest req = request();
        // 注意：request() 的终点纬度比起点高 0.001 度（约 111m），必须一并抹平，
        // 否则测到的是那 111m 而不是我们要构造的"起终点几乎重合"。
        req.setEndLat(req.getStartLat());
        // 经度只差 0.00001 度；该纬度处约 0.8785m（PostGIS ::geography 实测值）
        req.setEndLng(req.getStartLng() + 0.00001);

        RoutePlanResponse resp = service.plan(req);

        assertEquals(0.8785, resp.getStraightDistanceM(), 0.01,
                "经度差 0.00001 度在该纬度应约 0.88m");
        assertTrue(resp.getStraightDistanceM() < 1.0, "直线距离应小于 1m");
        assertNull(resp.getDetourRatio(), "直线距离过小时不应给出绕行比例");
        assertTrue(resp.getDetourM() > 0, "绕行增量本身仍可计算");
    }
}
