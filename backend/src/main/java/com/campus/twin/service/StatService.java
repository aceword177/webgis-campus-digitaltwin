package com.campus.twin.service;

import com.campus.twin.dto.CampusOverview;

/**
 * 统计服务接口
 */
public interface StatService {

    /**
     * 获取校园概览统计
     */
    CampusOverview getOverview();
}
