# 后端镜像：Maven 构建 → JRE 运行（多阶段，产物只带 jar）
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build

# 先只拷 pom，让依赖层可复用（改代码不会重下依赖）
COPY pom.xml ./
RUN mvn -B -q dependency:go-offline

COPY src ./src
RUN mvn -B -q clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /build/target/campus-digital-twin-1.0.0.jar /app/app.jar

# 数据库连接全部走环境变量（application-local.yml 里的默认值会被覆盖）
ENV SPRING_PROFILES_ACTIVE=local \
    DB_HOST=db \
    DB_PORT=5432 \
    DB_NAME=shp_data \
    SERVER_PORT=8080 \
    TZ=Asia/Shanghai

EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
