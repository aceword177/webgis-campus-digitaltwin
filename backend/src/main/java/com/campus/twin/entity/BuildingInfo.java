package com.campus.twin.entity;

/**
 * 建筑信息接口
 * 有 height 字段的建筑类实体统一实现此接口，方便白模拉伸
 */
public interface BuildingInfo {

    /** 获取建筑高度（楼层数） */
    Integer getHeight();

    /** 获取建筑名称 */
    String getName();

    /** 获取建筑类型标识 */
    String getBuildingType();
}
