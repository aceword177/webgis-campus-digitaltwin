package com.campus.twin;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 校园数字孪生 WebGIS 后端启动类
 *
 * @author campus-twin
 */
@SpringBootApplication
@MapperScan("com.campus.twin.mapper")
@EnableScheduling
public class CampusTwinApplication {

    public static void main(String[] args) {
        SpringApplication.run(CampusTwinApplication.class, args);
        System.out.println("""
                ====================================================
                  校园数字孪生 WebGIS 后端启动成功!
                  接口地址: http://localhost:8080
                  Swagger:  http://localhost:8080/swagger-ui.html
                ====================================================
                """);
    }
}
