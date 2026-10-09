package com.campus.twin.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.campus.twin.dto.DroneStatsVO;
import com.campus.twin.common.GeoMath;
import com.campus.twin.entity.DeliveryOrder;
import com.campus.twin.entity.Drone;
import com.campus.twin.entity.FlightRoute;
import com.campus.twin.mapper.DeliveryOrderMapper;
import com.campus.twin.mapper.DroneMapper;
import com.campus.twin.mapper.FlightRouteMapper;
import com.campus.twin.service.CanteenLocator;
import com.campus.twin.service.DroneService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class DroneServiceImpl implements DroneService {

    private final DroneMapper droneMapper;
    private final DeliveryOrderMapper orderMapper;
    private final FlightRouteMapper flightRouteMapper;
    private final CanteenLocator canteenLocator;
    private final ObjectMapper objectMapper;

    /** 无人机飞行速度(m/s)，与航线规划保持一致 */
    private static final double FLIGHT_SPEED_MPS = 5.0;

    /** 距食堂超过该距离(米)视为"不在食堂"，充电/归位时会被挪回食堂 */
    private static final double CANTEEN_RANGE_M = 20.0;

    /**
     * 位置写库去重阈值（度）。
     * 约 1e-5 度 ≈ 1.1 米：小于此位移视为"实质未动"，跳过写库。
     * 原值 1e-7 度 ≈ 1.1 厘米，几乎每次 2s 推进都会触发一次 UPDATE。
     */
    private static final double POSITION_EPSILON_DEG = 1e-5;


    @Override
    public List<Drone> list(String status) {
        LambdaQueryWrapper<Drone> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(status)) {
            wrapper.eq(Drone::getStatus, status);
        }
        wrapper.orderByAsc(Drone::getId);
        return droneMapper.selectList(wrapper);
    }

    @Override
    public Drone getById(Integer id) {
        return droneMapper.selectById(id);
    }

    @Override
    public DroneStatsVO getStats() {
        List<Drone> all = droneMapper.selectList(null);
        Map<String, Integer> byStatus = new HashMap<>();
        double totalBattery = 0;

        for (Drone d : all) {
            byStatus.merge(d.getStatus(), 1, Integer::sum);
            totalBattery += d.getBatteryPct();
        }

        return DroneStatsVO.builder()
                .total(all.size())
                .idle(byStatus.getOrDefault("idle", 0))
                .delivering(byStatus.getOrDefault("delivering", 0))
                .charging(byStatus.getOrDefault("charging", 0))
                .maintenance(byStatus.getOrDefault("maintenance", 0))
                .avgBattery(all.isEmpty() ? 0.0 : Math.round(totalBattery / all.size() * 10.0) / 10.0)
                .byStatus(byStatus)
                .build();
    }

    @Override
    public Drone updatePosition(Integer id, Double lng, Double lat, Integer battery) {
        Drone drone = droneMapper.selectById(id);
        if (drone == null) {
            throw new IllegalArgumentException("无人机不存在: " + id);
        }
        if (lng != null) drone.setCurrentLng(java.math.BigDecimal.valueOf(lng));
        if (lat != null) drone.setCurrentLat(java.math.BigDecimal.valueOf(lat));
        if (battery != null) drone.setBatteryPct(battery);
        drone.setLastUpdateTime(LocalDateTime.now());
        droneMapper.updateById(drone);
        return drone;
    }

    @Override
    public Drone getAvailableDrone() {
        // 电量不足口径：电量小于等于 30% 视为电量不足，不可派单（即 > 30 才可选）
        LambdaQueryWrapper<Drone> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Drone::getStatus, "idle")
                .gt(Drone::getBatteryPct, 30)
                .orderByDesc(Drone::getBatteryPct)
                .last("LIMIT 1");
        return droneMapper.selectOne(wrapper);
    }

    /**
     * 空闲无人机归位：每 15 秒执行一次
     * idle 且距最近食堂超过 CANTEEN_RANGE_M 的无人机挪回食堂周边待命，
     * 保证"空闲无人机都在食堂待命 → 起飞派单"的演示直观性
     */
    @Scheduled(fixedDelay = 15000)
    @Override
    public void repositionIdleDronesToCanteen() {
        LambdaQueryWrapper<Drone> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Drone::getStatus, "idle");
        List<Drone> idleDrones = droneMapper.selectList(wrapper);
        for (Drone d : idleDrones) {
            try {
                double lng = d.getCurrentLng() != null ? d.getCurrentLng().doubleValue() : 0.0;
                double lat = d.getCurrentLat() != null ? d.getCurrentLat().doubleValue() : 0.0;
                CanteenLocator.Canteen canteen = canteenLocator.nearest(lng, lat);
                if (canteen == null) {
                    continue;
                }
                if (GeoMath.haversine(lng, lat, canteen.lng(), canteen.lat()) > CANTEEN_RANGE_M) {
                    double[] spot = canteenLocator.parkingSpotFor(d.getId(), lng, lat);
                    if (spot == null) {
                        continue;
                    }
                    d.setCurrentLng(java.math.BigDecimal.valueOf(spot[0]));
                    d.setCurrentLat(java.math.BigDecimal.valueOf(spot[1]));
                    d.setLastUpdateTime(LocalDateTime.now());
                    droneMapper.updateById(d);
                    log.info("空闲无人机 {} 归位食堂待命，位置({}, {})", d.getDroneNo(),
                            String.format("%.5f", spot[0]), String.format("%.5f", spot[1]));
                }
            } catch (Exception e) {
                log.warn("空闲无人机 {} 归位失败: {}", d.getDroneNo(), e.getMessage());
            }
        }
    }

    /**
     * 配送中无人机实时位置推进：每 2 秒执行一次
     * 按 起飞时刻(assign_time) + 速度×飞行时间 沿航线插值，实时更新无人机坐标，
     * 使无人机在派送过程中真实移动，而非仅在播放动画时改变位置
     */
    @Scheduled(fixedDelay = 2000)
    public void simulateFlyingDrones() {
        LambdaQueryWrapper<DeliveryOrder> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(DeliveryOrder::getStatus, "delivering");
        List<DeliveryOrder> orders = orderMapper.selectList(wrapper);
        if (orders.isEmpty()) {
            return;
        }
        for (DeliveryOrder order : orders) {
            if (order.getDroneId() == null || order.getAssignTime() == null) {
                continue;
            }
            try {
                Drone drone = droneMapper.selectById(order.getDroneId());
                if (drone == null) {
                    continue;
                }
                FlightRoute route = flightRouteMapper.selectByOrderIdWithGeoJson(order.getId());
                if (route == null || route.getRouteGeom() == null) {
                    continue;
                }
                double[] pos = calcPositionAlongRoute(route.getRouteGeom(), order.getAssignTime());
                if (pos == null) {
                    continue;
                }
                // 位置基本无变化（已到终点/未起飞）时跳过写库，减少无效更新
                if (drone.getCurrentLng() != null && drone.getCurrentLat() != null
                        && Math.abs(drone.getCurrentLng().doubleValue() - pos[0]) < POSITION_EPSILON_DEG
                        && Math.abs(drone.getCurrentLat().doubleValue() - pos[1]) < POSITION_EPSILON_DEG) {
                    continue;
                }
                drone.setCurrentLng(java.math.BigDecimal.valueOf(pos[0]));
                drone.setCurrentLat(java.math.BigDecimal.valueOf(pos[1]));
                drone.setLastUpdateTime(LocalDateTime.now());
                droneMapper.updateById(drone);
            } catch (Exception e) {
                log.warn("推进无人机位置失败: orderId={}, {}", order.getId(), e.getMessage());
            }
        }
    }

    /** 按起飞时刻沿航线计算无人机当前位置，已飞完全程则返回终点 */
    private double[] calcPositionAlongRoute(String geojson, LocalDateTime startTime) {
        List<double[]> coords = parseRouteCoords(geojson);
        if (coords == null || coords.size() < 2) {
            return null;
        }
        double elapsed = Duration.between(startTime, LocalDateTime.now()).getSeconds();
        if (elapsed <= 0) {
            return coords.get(0);
        }
        double targetDist = elapsed * FLIGHT_SPEED_MPS;
        double acc = 0;
        for (int i = 1; i < coords.size(); i++) {
            double seg = haversine(coords.get(i - 1)[0], coords.get(i - 1)[1],
                    coords.get(i)[0], coords.get(i)[1]);
            if (acc + seg >= targetDist) {
                double t = seg > 0 ? (targetDist - acc) / seg : 0;
                return new double[]{
                        coords.get(i - 1)[0] + (coords.get(i)[0] - coords.get(i - 1)[0]) * t,
                        coords.get(i - 1)[1] + (coords.get(i)[1] - coords.get(i - 1)[1]) * t
                };
            }
            acc += seg;
        }
        return coords.get(coords.size() - 1);
    }

    /** 解析 LineString GeoJSON 为坐标数组 */
    @SuppressWarnings("unchecked")
    private List<double[]> parseRouteCoords(String geojson) {
        List<double[]> coords = new ArrayList<>();
        if (geojson == null || geojson.isBlank()) {
            return coords;
        }
        try {
            Map<String, Object> geo = objectMapper.readValue(geojson, Map.class);
            List<List<Number>> list = (List<List<Number>>) geo.get("coordinates");
            if (list != null) {
                for (List<Number> c : list) {
                    if (c != null && c.size() >= 2) {
                        coords.add(new double[]{c.get(0).doubleValue(), c.get(1).doubleValue()});
                    }
                }
            }
        } catch (Exception e) {
            log.warn("解析航线 GeoJSON 失败: {}", e.getMessage());
        }
        return coords;
    }

    /** 简易经纬度距离（米）：统一走 GeoMath，全项目只有一处实现 */
    private double haversine(double lng1, double lat1, double lng2, double lat2) {
        return GeoMath.haversine(lng1, lat1, lng2, lat2);
    }

    /**
     * 充电模拟定时任务：每 15 秒执行一次
     * 1) 充电中的无人机若不在食堂附近，先挪回最近食堂充电点（修正历史/初始数据）
     * 2) 电量每次恢复 5%，达到 80% 时恢复为空闲（可派单）
     */
    @Scheduled(fixedDelay = 15000)
    public void chargeDrones() {
        LambdaQueryWrapper<Drone> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Drone::getStatus, "charging");
        List<Drone> chargingDrones = droneMapper.selectList(wrapper);
        if (chargingDrones.isEmpty()) {
            return;
        }
        for (Drone d : chargingDrones) {
            // 充电地点统一在食堂：不在食堂附近的充电无人机自动挪回最近食堂
            moveToNearestCanteenIfAway(d);
            int newBattery = Math.min(100, d.getBatteryPct() + 5);
            d.setBatteryPct(newBattery);
            if (newBattery >= 80) {
                d.setStatus("idle");
                log.info("无人机 {} 充电完成(电量 {}%)，恢复空闲，位置({}, {})",
                        d.getDroneNo(), newBattery, d.getCurrentLng(), d.getCurrentLat());
            } else {
                log.debug("无人机 {} 充电中，电量 {}%", d.getDroneNo(), newBattery);
            }
            d.setLastUpdateTime(LocalDateTime.now());
            droneMapper.updateById(d);
        }
    }

    /** 若无人机距最近食堂超过 CANTEEN_RANGE_M，则将其位置挪到食堂的确定性待命落点 */
    private void moveToNearestCanteenIfAway(Drone drone) {
        double lng = drone.getCurrentLng() != null ? drone.getCurrentLng().doubleValue() : 0.0;
        double lat = drone.getCurrentLat() != null ? drone.getCurrentLat().doubleValue() : 0.0;
        CanteenLocator.Canteen canteen = canteenLocator.nearest(lng, lat);
        if (canteen == null) {
            return;
        }
        if (GeoMath.haversine(lng, lat, canteen.lng(), canteen.lat()) > CANTEEN_RANGE_M) {
            double[] spot = canteenLocator.parkingSpotFor(drone.getId(), lng, lat);
            if (spot == null) {
                return;
            }
            drone.setCurrentLng(java.math.BigDecimal.valueOf(spot[0]));
            drone.setCurrentLat(java.math.BigDecimal.valueOf(spot[1]));
            log.info("无人机 {} 位置修正至食堂充电点({}, {})", drone.getDroneNo(),
                    String.format("%.5f", spot[0]), String.format("%.5f", spot[1]));
        }
    }
}
