package com.campus.twin.service.impl;

import com.campus.twin.entity.Dormitory;
import com.campus.twin.entity.Drone;
import com.campus.twin.entity.Restaurant;
import com.campus.twin.mapper.DeliveryOrderMapper;
import com.campus.twin.mapper.DormitoryMapper;
import com.campus.twin.mapper.DroneMapper;
import com.campus.twin.mapper.RestaurantMapper;
import com.campus.twin.service.AutoOrderSwitch;
import com.campus.twin.service.OrderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 自动补单开关单元测试。
 *
 * <p>锁住开关的语义（这是"默认关闭"这个承诺的可执行版本）：
 * <ol>
 *   <li><b>默认关闭时调度器不得触碰数据库</b> —— 关掉开关必须真的零副作用，
 *       而不是"查了库但不写"；</li>
 *   <li><b>开启后正常生成并派单</b>，且计数加一（前端横幅要显示这个数）；</li>
 *   <li><b>再次关闭后恢复不生成，计数清零</b>。</li>
 * </ol>
 *
 * <p>注意：这里用 {@code new AutoOrderSwitch()} 直接构造，<b>不会</b>触发
 * {@code @PostConstruct}，因此其状态等价于"配置里没写、走默认值 false"。
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AutoOrderSchedulerTest {

    @Mock private DroneMapper droneMapper;
    @Mock private DeliveryOrderMapper orderMapper;
    @Mock private RestaurantMapper restaurantMapper;
    @Mock private DormitoryMapper dormitoryMapper;
    @Mock private OrderService orderService;

    private AutoOrderSwitch autoOrderSwitch;
    private AutoOrderScheduler scheduler;

    @BeforeEach
    void setUp() {
        autoOrderSwitch = new AutoOrderSwitch();
        scheduler = new AutoOrderScheduler(
                droneMapper, orderMapper, restaurantMapper, dormitoryMapper, orderService, autoOrderSwitch);
    }

    /** 备好一个"可派单"的最小场景：1 架空闲满电机 + 1 餐厅 + 1 宿舍楼，无进行中订单 */
    private void givenOneAssignableDrone() {
        Drone drone = new Drone();
        drone.setId(1);
        drone.setDroneNo("UAV-001");
        drone.setStatus("idle");
        drone.setBatteryPct(90);
        when(droneMapper.selectList(any())).thenReturn(List.of(drone));

        Restaurant restaurant = new Restaurant();
        restaurant.setId(1);
        restaurant.setName("食堂1");
        when(restaurantMapper.selectList(any())).thenReturn(List.of(restaurant));

        Dormitory dormitory = new Dormitory();
        dormitory.setId(1);
        dormitory.setName("1号宿舍楼");
        when(dormitoryMapper.selectList(any())).thenReturn(List.of(dormitory));

        // 全局进行中订单数与"该无人机进行中订单数"均为 0
        when(orderMapper.selectCount(any())).thenReturn(0L);
    }

    @Test
    @DisplayName("默认关闭：调度器不得触碰数据库")
    void disabledByDefault_doesNotTouchDb() {
        assertFalse(autoOrderSwitch.isEnabled(), "默认应为关闭");

        scheduler.autoGenerateOrders();

        verify(orderMapper, never()).selectCount(any());
        verify(orderMapper, never()).insert(any());
        verify(droneMapper, never()).selectList(any());
        verify(orderService, never()).assignDrone(any(), any());
    }

    @Test
    @DisplayName("开启后：生成一单 + 派单一次 + 计数加一")
    void enabled_generatesOneOrderAndRecordsCount() {
        autoOrderSwitch.switchTo(true);
        assertTrue(autoOrderSwitch.isEnabled());
        givenOneAssignableDrone();

        scheduler.autoGenerateOrders();

        verify(orderMapper, times(1)).insert(any());
        verify(orderService, times(1)).assignDrone(any(), eq(1));
        assertEquals(1L, autoOrderSwitch.getGenerated(), "应记录自动生成 1 单");
    }

    @Test
    @DisplayName("达到全局上限（≥8 单在飞）时不再生成")
    void reachesMaxActiveOrders_generatesNothing() {
        autoOrderSwitch.switchTo(true);
        when(orderMapper.selectCount(any())).thenReturn(8L);

        scheduler.autoGenerateOrders();

        verify(orderMapper, never()).insert(any());
        assertEquals(0L, autoOrderSwitch.getGenerated());
    }

    @Test
    @DisplayName("再次关闭：不再生成，且计数清零")
    void switchedOffAgain_doesNotGenerateAndResetsCount() {
        autoOrderSwitch.switchTo(true);
        autoOrderSwitch.recordGenerated();
        assertEquals(1L, autoOrderSwitch.getGenerated());

        autoOrderSwitch.switchTo(false);
        scheduler.autoGenerateOrders();

        assertFalse(autoOrderSwitch.isEnabled());
        assertEquals(0L, autoOrderSwitch.getGenerated(), "关闭后计数应清零");
        verify(orderMapper, never()).insert(any());
    }
}
