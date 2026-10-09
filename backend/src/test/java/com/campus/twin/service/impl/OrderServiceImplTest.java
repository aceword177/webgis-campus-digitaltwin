package com.campus.twin.service.impl;

import com.campus.twin.dto.RoutePlanRequest;
import com.campus.twin.dto.RoutePlanResponse;
import com.campus.twin.entity.DeliveryOrder;
import com.campus.twin.entity.Drone;
import com.campus.twin.entity.Restaurant;
import com.campus.twin.mapper.DeliveryOrderMapper;
import com.campus.twin.mapper.DroneMapper;
import com.campus.twin.mapper.FlightRouteMapper;
import com.campus.twin.mapper.RestaurantMapper;
import com.campus.twin.mapper.SpatialQueryMapper;
import com.campus.twin.service.CanteenLocator;
import com.campus.twin.service.RouteService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 订单状态机单元测试。
 *
 * <p>这是本项目最核心的业务逻辑，也是最容易被后续改动破坏的部分：
 * <pre>
 *   pending ──assignDrone──→ delivering ──confirmDeliver──→ delivered
 *      │                          │
 *      └──────cancel──────────────┴──────────────────────→ cancelled
 * </pre>
 *
 * <p>本测试锁住三类不变量：
 * <ol>
 *   <li><b>非法流转必须被拒绝</b>（已送达的单不能再派车、待接单的单不能确认送达）；</li>
 *   <li><b>合法流转必须同时更新订单与无人机两侧状态</b>
 *       —— 只改一边会导致"订单在飞但无人机空闲"这类脏状态，
 *       后面的自动补单会据此重复派单；</li>
 *   <li><b>送达前的到达距离校验必须生效</b>（&gt;30m 拒绝），
 *       否则会出现"无人机还在半路就确认收货"。</li>
 * </ol>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OrderServiceImplTest {

    @Mock private DeliveryOrderMapper orderMapper;
    @Mock private RestaurantMapper restaurantMapper;
    @Mock private com.campus.twin.mapper.DormitoryMapper dormitoryMapper;
    @Mock private DroneMapper droneMapper;
    @Mock private FlightRouteMapper flightRouteMapper;
    @Mock private SpatialQueryMapper spatialQueryMapper;
    @Mock private RouteService routeService;
    @Mock private CanteenLocator canteenLocator;
    @Mock private ObjectMapper objectMapper;

    @InjectMocks private OrderServiceImpl service;

    private static final double DORM_LNG = 114.4683;
    private static final double DORM_LAT = 37.9842;

    @BeforeEach
    void setUp() throws Exception {
        // 质心解析：spatialQueryMapper 返回 Map，其中 centroid 是 GeoJSON 字符串
        when(spatialQueryMapper.selectById(eq("other_buildings"), anyInt()))
                .thenReturn(Map.of("id", 4,
                        "centroid", "{\"type\":\"Point\",\"coordinates\":[114.4704,37.9832]}"));
        when(spatialQueryMapper.selectById(eq("dormitory"), anyInt()))
                .thenReturn(Map.of("id", 1,
                        "centroid", "{\"type\":\"Point\",\"coordinates\":[" + DORM_LNG + "," + DORM_LAT + "]}"));

        // ObjectMapper 用于解析上面的 centroid 字符串
        when(objectMapper.readValue(anyString(), eq(Map.class))).thenAnswer(inv -> {
            String s = inv.getArgument(0);
            int cs = s.indexOf('[');
            int ce = s.indexOf(']');
            String[] parts = s.substring(cs + 1, ce).split(",");
            return Map.of("type", "Point",
                    "coordinates", List.of(Double.parseDouble(parts[0]), Double.parseDouble(parts[1])));
        });

        // 餐厅存在（派单需要它的 buildingId）
        Restaurant r = new Restaurant();
        r.setId(1);
        r.setName("食堂1");
        r.setBuildingId(4);
        when(restaurantMapper.selectById(anyInt())).thenReturn(r);

        // 食堂落点：送达后无人机要"回食堂待命/充电"，会用到确定性落点
        when(canteenLocator.parkingSpotFor(any(), anyDouble(), anyDouble()))
                .thenReturn(new double[]{114.4704, 37.9832});
        when(canteenLocator.nearest(anyDouble(), anyDouble()))
                .thenReturn(new CanteenLocator.Canteen(1, "食堂1", 114.4704, 37.9832));

        // 航线规划返回一条最小可用结果
        when(routeService.plan(any(RoutePlanRequest.class))).thenReturn(
                RoutePlanResponse.builder()
                        .routeGeojson("{\"type\":\"LineString\",\"coordinates\":[[114.4704,37.9832],[114.4683,37.9842]]}")
                        .waypoints(List.of(new double[]{114.4704, 37.9832}, new double[]{114.4683, 37.9842}))
                        .waypointsCount(2)
                        .distanceM(250.0)
                        .estimatedSeconds(50)
                        .altitudeM(50.0)
                        .build());
    }

    private DeliveryOrder order(int id, String status) {
        DeliveryOrder o = new DeliveryOrder();
        o.setId(id);
        o.setOrderNo("DD20260101000000ABCDEF");
        o.setRestaurantId(1);
        o.setDormitoryId(1);
        o.setStatus(status);
        o.setAmount(new BigDecimal("20.00"));
        return o;
    }

    private Drone drone(int id, String status, int battery) {
        Drone d = new Drone();
        d.setId(id);
        d.setDroneNo("UAV-" + String.format("%03d", id));
        d.setStatus(status);
        d.setBatteryPct(battery);
        d.setCurrentLng(BigDecimal.valueOf(DORM_LNG));
        d.setCurrentLat(BigDecimal.valueOf(DORM_LAT));
        return d;
    }

    // ================= assignDrone =================

    @Test
    @DisplayName("派单：pending 订单 + 空闲无人机 → 订单转 delivering，无人机也转 delivering")
    void assignDroneTransitionsBothSides() {
        DeliveryOrder o = order(10, "pending");
        Drone d = drone(7, "idle", 90);
        when(orderMapper.selectByIdForUpdate(10)).thenReturn(o);
        when(droneMapper.selectIdleByIdForUpdate(7)).thenReturn(d);

        DeliveryOrder result = service.assignDrone(10, 7);

        assertEquals("delivering", result.getStatus(), "订单应转为配送中");
        assertEquals(7, result.getDroneId(), "订单应记录无人机 id");
        assertTrue(result.getAssignTime() != null, "应记录分配时间");
        assertEquals("delivering", d.getStatus(), "无人机也应转为配送中（只改订单会造成脏状态）");
        verify(orderMapper).updateById(o);
        verify(droneMapper).updateById(d);
        verify(routeService).saveRoute(eq(10), eq(7), any(RoutePlanResponse.class));
    }

    @Test
    @DisplayName("派单：订单不存在 → IllegalArgumentException")
    void assignDroneRejectsMissingOrder() {
        when(orderMapper.selectByIdForUpdate(99)).thenReturn(null);
        assertThrows(IllegalArgumentException.class, () -> service.assignDrone(99, 7));
        verify(droneMapper, never()).updateById(any());
    }

    @Test
    @DisplayName("派单：已送达的订单不得再派车 → IllegalStateException")
    void assignDroneRejectsDeliveredOrder() {
        when(orderMapper.selectByIdForUpdate(11)).thenReturn(order(11, "delivered"));
        assertThrows(IllegalStateException.class, () -> service.assignDrone(11, 7));
        verify(routeService, never()).plan(any());
    }

    @Test
    @DisplayName("派单：配送中的订单不得重复派车 → IllegalStateException")
    void assignDroneRejectsDeliveringOrder() {
        when(orderMapper.selectByIdForUpdate(12)).thenReturn(order(12, "delivering"));
        assertThrows(IllegalStateException.class, () -> service.assignDrone(12, 7));
    }

    @Test
    @DisplayName("派单：已取消的订单不得再派车 → IllegalStateException")
    void assignDroneRejectsCancelledOrder() {
        when(orderMapper.selectByIdForUpdate(13)).thenReturn(order(13, "cancelled"));
        assertThrows(IllegalStateException.class, () -> service.assignDrone(13, 7));
    }

    @Test
    @DisplayName("派单：指定了不空闲的无人机 → IllegalStateException")
    void assignDroneRejectsBusyDrone() {
        when(orderMapper.selectByIdForUpdate(14)).thenReturn(order(14, "pending"));
        when(droneMapper.selectIdleByIdForUpdate(7)).thenReturn(null); // 不空闲
        assertThrows(IllegalStateException.class, () -> service.assignDrone(14, 7));
        verify(orderMapper, never()).updateById(any());
    }

    @Test
    @DisplayName("派单：droneId 为 null 时走自动挑选空闲无人机")
    void assignDronePicksAvailableWhenDroneIdNull() {
        DeliveryOrder o = order(15, "pending");
        Drone d = drone(3, "idle", 80);
        when(orderMapper.selectByIdForUpdate(15)).thenReturn(o);
        when(droneMapper.selectAvailableForUpdate()).thenReturn(d);

        service.assignDrone(15, null);

        assertEquals(3, o.getDroneId());
        assertEquals("delivering", d.getStatus());
    }

    // ================= confirmDeliver =================

    @Test
    @DisplayName("送达：无人机在 30m 内 → 订单转 delivered 并记录送达时间")
    void confirmDeliverSucceedsWhenArrived() {
        DeliveryOrder o = order(20, "delivering");
        o.setDroneId(7);
        Drone d = drone(7, "delivering", 90);
        when(orderMapper.selectById(20)).thenReturn(o);
        when(droneMapper.selectById(7)).thenReturn(d);
        when(spatialQueryMapper.selectDistanceToFeature(eq("dormitory"), anyInt(), any(), any()))
                .thenReturn(12.5);   // 12.5m < 30m

        DeliveryOrder result = service.confirmDeliver(20);

        assertEquals("delivered", result.getStatus());
        assertTrue(result.getDeliverTime() != null, "应记录送达时间");
    }

    @Test
    @DisplayName("送达：无人机距收货点 500m → 拒绝，订单状态不变")
    void confirmDeliverRejectsWhenTooFar() {
        DeliveryOrder o = order(21, "delivering");
        o.setDroneId(7);
        when(orderMapper.selectById(21)).thenReturn(o);
        when(droneMapper.selectById(7)).thenReturn(drone(7, "delivering", 90));
        when(spatialQueryMapper.selectDistanceToFeature(eq("dormitory"), anyInt(), any(), any()))
                .thenReturn(500.0);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.confirmDeliver(21));
        assertTrue(ex.getMessage().contains("未到达收货地点"),
                "错误信息应说明未到达，实际: " + ex.getMessage());
        assertEquals("delivering", o.getStatus(), "被拒绝时订单状态不得改变");
    }

    @Test
    @DisplayName("送达：待接单的订单不能确认送达 → IllegalStateException")
    void confirmDeliverRejectsPendingOrder() {
        when(orderMapper.selectById(22)).thenReturn(order(22, "pending"));
        assertThrows(IllegalStateException.class, () -> service.confirmDeliver(22));
    }

    @Test
    @DisplayName("送达：已送达的订单不能重复确认 → IllegalStateException")
    void confirmDeliverRejectsAlreadyDelivered() {
        when(orderMapper.selectById(23)).thenReturn(order(23, "delivered"));
        assertThrows(IllegalStateException.class, () -> service.confirmDeliver(23));
    }

    @Test
    @DisplayName("送达：无人机位置未知 → 拒绝")
    void confirmDeliverRejectsWhenDronePositionUnknown() {
        DeliveryOrder o = order(24, "delivering");
        o.setDroneId(7);
        Drone d = drone(7, "delivering", 90);
        d.setCurrentLng(null);
        d.setCurrentLat(null);
        when(orderMapper.selectById(24)).thenReturn(o);
        when(droneMapper.selectById(7)).thenReturn(d);

        assertThrows(IllegalArgumentException.class, () -> service.confirmDeliver(24));
    }

    // ================= cancel =================

    @Test
    @DisplayName("取消：配送中的订单 → cancelled，并释放无人机回 idle")
    void cancelReleasesDrone() {
        DeliveryOrder o = order(30, "delivering");
        o.setDroneId(7);
        Drone d = drone(7, "delivering", 60);
        when(orderMapper.selectById(30)).thenReturn(o);
        when(droneMapper.selectById(7)).thenReturn(d);

        DeliveryOrder result = service.cancel(30, "用户取消");

        assertEquals("cancelled", result.getStatus());
        assertEquals("用户取消", result.getRemark());
        assertEquals("idle", d.getStatus(), "取消后必须释放无人机，否则它永远卡在配送中");
        verify(droneMapper, times(1)).updateById(d);
    }

    @Test
    @DisplayName("取消：已送达的订单不能取消")
    void cancelRejectsDelivered() {
        when(orderMapper.selectById(31)).thenReturn(order(31, "delivered"));
        assertThrows(IllegalStateException.class, () -> service.cancel(31, "x"));
    }

    @Test
    @DisplayName("取消：已取消的订单不能重复取消")
    void cancelRejectsAlreadyCancelled() {
        when(orderMapper.selectById(32)).thenReturn(order(32, "cancelled"));
        assertThrows(IllegalStateException.class, () -> service.cancel(32, "x"));
    }

    @Test
    @DisplayName("取消：待接单（尚未派车）的订单可直接取消，不报错")
    void cancelPendingWithoutDrone() {
        DeliveryOrder o = order(33, "pending");
        when(orderMapper.selectById(33)).thenReturn(o);

        DeliveryOrder result = service.cancel(33, null);

        assertEquals("cancelled", result.getStatus());
        assertEquals("用户取消", result.getRemark(), "reason 为空时应给默认值");
    }

    // ================= create =================

    @Test
    @DisplayName("创建：餐厅不存在 → IllegalArgumentException（不落库）")
    void createRejectsMissingRestaurant() {
        when(restaurantMapper.selectById(999)).thenReturn(null);
        com.campus.twin.dto.OrderCreateRequest req = new com.campus.twin.dto.OrderCreateRequest();
        req.setRestaurantId(999);
        req.setDormitoryId(1);
        assertThrows(IllegalArgumentException.class, () -> service.create(req));
        verify(orderMapper, never()).insert(any());
    }

    @Test
    @DisplayName("创建：成功时状态为 pending，且订单号不重复")
    void createProducesPendingOrderWithUniqueNo() {
        when(dormitoryMapper.selectById(1)).thenReturn(new com.campus.twin.entity.Dormitory());

        com.campus.twin.dto.OrderCreateRequest a = new com.campus.twin.dto.OrderCreateRequest();
        a.setRestaurantId(1);
        a.setDormitoryId(1);
        com.campus.twin.dto.OrderCreateRequest b = new com.campus.twin.dto.OrderCreateRequest();
        b.setRestaurantId(1);
        b.setDormitoryId(1);

        DeliveryOrder oa = service.create(a);
        DeliveryOrder ob = service.create(b);

        assertEquals("pending", oa.getStatus());
        assertTrue(oa.getOrderNo().startsWith("DD"), "订单号应以 DD 开头");
        assertTrue(!oa.getOrderNo().equals(ob.getOrderNo()),
                "同一秒内创建的两单也不应撞号（曾经用时间戳+随机数，有碰撞风险）");
    }
}
