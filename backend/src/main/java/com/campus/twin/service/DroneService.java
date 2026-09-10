package com.campus.twin.service;

import com.campus.twin.dto.DroneStatsVO;
import com.campus.twin.entity.Drone;

import java.util.List;

public interface DroneService {

    List<Drone> list(String status);

    Drone getById(Integer id);

    DroneStatsVO getStats();

    /** 更新无人机位置和电量（模拟实时上报） */
    Drone updatePosition(Integer id, Double lng, Double lat, Integer battery);

    /** 获取一个空闲无人机（用于自动调度） */
    Drone getAvailableDrone();

    /** 空闲无人机归位：距最近食堂超过阈值(20m)的空闲无人机挪回食堂周边待命 */
    void repositionIdleDronesToCanteen();
}
