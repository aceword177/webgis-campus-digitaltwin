package com.campus.twin.config;

import com.campus.twin.mapper.SystemMapper;
import com.campus.twin.service.DroneService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * 启动时数据清理：修正历史脏数据
 * 1) 分配超过 1 天仍未送达的 delivering 订单 → delivered（已完成）
 * 2) 分配超过 1 天仍停留在 assigned 的订单 → cancelled（释放无人机，避免卡死自动补单）
 * 3) 同步将这些订单的航线状态置为 completed（避免仍以 flying 显示在地图上）
 * 4) 无配送中订单但状态为 delivering 的无人机 → idle
 * 5) 空闲无人机归位食堂待命（距食堂过远时挪回食堂周边）
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataCleanupRunner implements ApplicationRunner {

    private final SystemMapper systemMapper;
    private final DroneService droneService;

    @Override
    public void run(ApplicationArguments args) {
        try {
            int staleOrders = systemMapper.completeStaleOrders();
            int staleAssigned = systemMapper.completeStaleAssignedOrders();
            int staleRoutes = systemMapper.completeStaleRoutes();
            int staleDrones = systemMapper.resetStaleDrones();
            droneService.repositionIdleDronesToCanteen();
            log.info("启动数据清理完成: 历史订单完成 {} 条, 历史未起飞订单作废 {} 条, 航线状态同步 {} 条, 无人机状态修正 {} 架, 空闲无人机已归位食堂",
                    staleOrders, staleAssigned, staleRoutes, staleDrones);
        } catch (Exception e) {
            log.warn("启动数据清理失败(不影响启动): {}", e.getMessage());
        }
    }
}
