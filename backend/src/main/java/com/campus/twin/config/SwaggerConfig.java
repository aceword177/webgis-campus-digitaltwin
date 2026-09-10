package com.campus.twin.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Swagger / OpenAPI 文档配置
 */
@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("校园数字孪生 WebGIS API 文档")
                        .version("1.0.0")
                        .description("基于 Spring Boot + PostGIS 的校园数字孪生后端服务，包含空间查询、MVT矢量瓦片、模拟物联网等接口")
                        .contact(new Contact().name("campus-twin")));
    }
}
