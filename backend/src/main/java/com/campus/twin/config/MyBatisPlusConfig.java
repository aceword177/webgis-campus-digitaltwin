package com.campus.twin.config;

import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * MyBatis-Plus 配置 - 分页插件
 */
@Configuration
public class MyBatisPlusConfig {

    /**
     * 单页最大条数：兜底防滥用。
     *
     * <p>控制器侧已经对 {@code size} 做了钳制，这里再设一道全局上限，
     * 覆盖所有走 MyBatis-Plus 分页的查询（含将来新增的、以及忘记钳制的接口），
     * 避免 {@code ?size=1000000} 让服务端一次性物化大量行。
     */
    private static final long MAX_PAGE_LIMIT = 200L;

    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
        PaginationInnerInterceptor pagination =
                new PaginationInnerInterceptor(DbType.POSTGRE_SQL);
        pagination.setMaxLimit(MAX_PAGE_LIMIT);
        interceptor.addInnerInterceptor(pagination);
        return interceptor;
    }
}
