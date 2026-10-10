@echo off
echo ============================================
echo   Campus Digital Twin WebGIS - Backend
echo ============================================
echo.

REM ===== JDK: prefer a usable system JAVA_HOME, fall back to IntelliJ IDEA's bundled JDK =====
if not defined JAVA_HOME goto :jdk_bundled
if exist "%JAVA_HOME%\bin\java.exe" goto :jdk_ready
echo [WARN] JAVA_HOME points to "%JAVA_HOME%" but has no bin\java.exe - ignoring it.
set "JAVA_HOME="
:jdk_bundled
if not exist "D:\IntelliJ IDEA 2026.2.0.1\jbr\bin\java.exe" goto :jdk_ready
set "JAVA_HOME=D:\IntelliJ IDEA 2026.2.0.1\jbr"
:jdk_ready
if defined JAVA_HOME set "PATH=%JAVA_HOME%\bin;%PATH%"

REM ===== Maven: prefer the one already on PATH, fall back to IntelliJ IDEA's bundled Maven =====
call mvn -version >nul 2>nul
if not errorlevel 1 goto :mvn_ready
if not exist "D:\IntelliJ IDEA 2026.2.0.1\plugins\maven-plugin\lib\maven3\bin\mvn.cmd" goto :mvn_ready
set "MAVEN_HOME=D:\IntelliJ IDEA 2026.2.0.1\plugins\maven-plugin\lib\maven3"
set "PATH=%MAVEN_HOME%\bin;%PATH%"
:mvn_ready

REM ===== Fail fast with a readable message instead of a cryptic one =====
java -version >nul 2>nul
if errorlevel 1 (
    echo [ERROR] No working JDK found.
    echo         Install JDK 17+ and set JAVA_HOME, then run this script again.
    echo.
    pause
    exit /b 1
)
call mvn -version >nul 2>nul
if errorlevel 1 (
    echo [ERROR] No working Maven found.
    echo         Install Maven 3.6+ or add it to PATH, then run this script again.
    echo.
    pause
    exit /b 1
)

if defined JAVA_HOME  echo [ENV] JAVA_HOME  = %JAVA_HOME%
if defined MAVEN_HOME echo [ENV] MAVEN_HOME = %MAVEN_HOME%
java -version
echo.
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
