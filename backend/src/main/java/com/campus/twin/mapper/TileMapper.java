package com.campus.twin.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * MVT 矢量瓦片 Mapper
 * 利用 PostGIS 原生 ST_AsMVT / ST_AsMVTGeom 函数生成矢量瓦片
 */
@Mapper
public interface TileMapper {

    /**
     * 生成指定表的 MVT 矢量瓦片
     *
     * <p><b>为什么返回 List&lt;byte[]&gt; 而不是 byte[]：</b>
     * MyBatis 的 {@code TypeAliasRegistry} 把别名 {@code byte[]} 注册为<b>对象数组</b>
     * {@code java.lang.Byte[]}，原始类型数组的别名是 {@code _byte[]}。
     * 同时 {@code MapperMethod.MethodSignature#returnsMany} 的判定是
     * {@code returnType.isArray()}，而 {@code byte[].class.isArray()} 为 true，
     * 因此声明为 {@code byte[]} 的方法会被当作"返回多行"处理，走
     * {@code executeForMany -> convertToArray}；其中
     * {@code getComponentType()} 为基本类型 {@code byte}，于是执行
     * {@code Array.set(byte[], i, <元素>)}，对 {@code Byte[]} 或 {@code byte[]}
     * 元素都会抛 {@code IllegalArgumentException: argument type mismatch}。
     * 详见 MapperMethod.java:179-189。
     *
     * <p>改为「返回多行 + XML 用 {@code _byte[]} 别名」后，每行由
     * {@code ByteArrayTypeHandler} 直接取出 {@code byte[]} 元素，不再经过 convertToArray。
     * ST_AsMVT 是无 GROUP BY 的聚合，结果恒为 1 行，由调用方取首行即可。
     *
     * @param table 表名
     * @param z     缩放级别
     * @param x     瓦片 X 坐标
     * @param y     瓦片 Y 坐标
     * @return 单元素列表（元素为 MVT protobuf 二进制）；瓦片为空时元素为 null 或空列表
     */
    List<byte[]> selectMvt(@Param("table") String table,
                           @Param("z") Integer z,
                           @Param("x") Integer x,
                           @Param("y") Integer y);
}
