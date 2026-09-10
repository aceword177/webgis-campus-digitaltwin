package com.campus.twin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

/**
 * 图层元数据 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LayerMeta implements Serializable {

    /** 表名 */
    private String tableName;

    /** 中文名称 */
    private String label;

    /** 要素类型：polygon / line / point */
    private String geometryType;

    /** 记录数 */
    private Integer count;

    /** 是否有高度字段（可拉伸白模） */
    private Boolean hasHeight;
}
