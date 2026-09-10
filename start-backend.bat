@echo off
echo ============================================
echo   Campus Digital Twin WebGIS - Backend
echo ============================================
echo.

REM ===== Use IntelliJ IDEA bundled JDK 25 =====
set "JAVA_HOME=D:\IntelliJ IDEA 2026.2.0.1\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"

REM ===== Use IntelliJ IDEA bundled Maven 3.9 =====
set "MAVEN_HOME=D:\IntelliJ IDEA 2026.2.0.1\plugins\maven-plugin\lib\maven3"
set "PATH=%MAVEN_HOME%\bin;%PATH%"

echo [ENV] JAVA_HOME = %JAVA_HOME%
java -version
echo.
echo [ENV] MAVEN_HOME = %MAVEN_HOME%
call mvn -version
echo.
echo ============================================
echo   Starting backend server...
echo   API:     http://localhost:8080
echo   Swagger: http://localhost:8080/swagger-ui.html
echo ============================================
echo.

cd /d "%~dp0backend"
call mvn spring-boot:run

pause
