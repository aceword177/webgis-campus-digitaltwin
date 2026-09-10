@echo off
chcp 65001 >nul
echo ============================================
echo   校园数字孪生 WebGIS - 后端启动脚本
echo ============================================
echo.

REM ===== 配置 JDK（使用 IntelliJ IDEA 自带 JDK 25）=====
set "JAVA_HOME=D:\IntelliJ IDEA 2026.2.0.1\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"

REM ===== 配置 Maven（使用 IntelliJ IDEA 自带 Maven 3.9）=====
set "MAVEN_HOME=D:\IntelliJ IDEA 2026.2.0.1\plugins\maven-plugin\lib\maven3"
set "PATH=%MAVEN_HOME%\bin;%PATH%"

echo [环境] JAVA_HOME = %JAVA_HOME%
java -version
echo.
echo [环境] MAVEN_HOME = %MAVEN_HOME%
call mvn -version
echo.
echo ============================================
echo   正在启动后端服务...
echo   接口地址: http://localhost:8080
echo   Swagger:  http://localhost:8080/swagger-ui.html
echo ============================================
echo.

cd /d "%~dp0backend"
call mvn spring-boot:run

pause
