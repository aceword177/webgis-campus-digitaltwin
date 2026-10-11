@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   Campus Digital Twin WebGIS - Backend
echo ============================================
echo.

REM ============================================================================
REM  本项目的硬性前提：JDK 17+
REM   - pom.xml 的 java.version = 17
REM   - spring-boot-maven-plugin 3.2.5 的 RunMojo 编译为 class file 61.0（Java 17），
REM     在 Java 11 上会直接失败：
REM     Unable to load the mojo 'run' ... only recognizes class file versions up to 55.0
REM
REM  ⚠️ 本机 Machine 级 JAVA_HOME 指向 C:\，而 C:\bin\java.exe 是 Java 11.0.32.1。
REM     所以"JAVA_HOME 下存在 bin\java.exe"**不能**作为可用判据，必须验主版本 >= 17。
REM ============================================================================
set "REQUIRED_MAJOR=17"
REM 以下三个路径是本机已知位置（与 IDEA 安装位置一样属于机器相关配置）
set "KNOWN_JDK17=C:\jdk-17.0.20+8"
set "KNOWN_JBR=D:\IntelliJ IDEA 2026.2.0.1\jbr"
set "KNOWN_MAVEN=D:\IntelliJ IDEA 2026.2.0.1\plugins\maven-plugin\lib\maven3"

set "ORIG_JAVA_HOME=%JAVA_HOME%"
set "JAVA_HOME="

REM ---- 候选 1：系统 JAVA_HOME（仅当主版本达标）----
if defined ORIG_JAVA_HOME (
    call :probe_jdk "%ORIG_JAVA_HOME%"
    if defined PROBE_MAJOR (
        if !PROBE_MAJOR! GEQ %REQUIRED_MAJOR% (
            set "JAVA_HOME=%ORIG_JAVA_HOME%"
        ) else (
            echo [WARN] JAVA_HOME=!ORIG_JAVA_HOME! is Java !PROBE_MAJOR!, but this project needs JDK %REQUIRED_MAJOR%+ - ignoring it.
        )
    ) else (
        echo [WARN] JAVA_HOME=!ORIG_JAVA_HOME! has no working bin\java.exe - ignoring it.
    )
)

REM ---- 候选 2：本机已知的 JDK 17 ----
if not defined JAVA_HOME (
    call :probe_jdk "%KNOWN_JDK17%"
    if defined PROBE_MAJOR if !PROBE_MAJOR! GEQ %REQUIRED_MAJOR% set "JAVA_HOME=%KNOWN_JDK17%"
)

REM ---- 候选 3：IntelliJ IDEA 自带 JBR ----
if not defined JAVA_HOME (
    call :probe_jdk "%KNOWN_JBR%"
    if defined PROBE_MAJOR if !PROBE_MAJOR! GEQ %REQUIRED_MAJOR% set "JAVA_HOME=%KNOWN_JBR%"
)

if not defined JAVA_HOME (
    echo [ERROR] No JDK %REQUIRED_MAJOR%+ found on this machine.
    echo         Install JDK %REQUIRED_MAJOR%+ and set JAVA_HOME to it, then run this script again.
    echo.
    pause
    exit /b 1
)
set "PATH=%JAVA_HOME%\bin;%PATH%"

REM ===== Maven：优先 PATH 上可用的，否则回退 IDEA 自带 =====
call mvn -version >nul 2>nul
if errorlevel 1 (
    if exist "%KNOWN_MAVEN%\bin\mvn.cmd" (
        set "MAVEN_HOME=%KNOWN_MAVEN%"
        set "PATH=!MAVEN_HOME!\bin;!PATH!"
    )
)
call mvn -version >nul 2>nul
if errorlevel 1 (
    echo [ERROR] No working Maven found.
    echo         Install Maven 3.6+ or add it to PATH, then run this script again.
    echo.
    pause
    exit /b 1
)

echo [ENV] JAVA_HOME  = !JAVA_HOME!
java -version
echo.
if defined MAVEN_HOME echo [ENV] MAVEN_HOME = !MAVEN_HOME!
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
exit /b 0

REM ============================================================================
REM  :probe_jdk  %1 = 候选 JDK 根目录
REM  成功时设置 PROBE_MAJOR（主版本号）；任何一步失败则不设置
REM ============================================================================
:probe_jdk
set "PROBE_MAJOR="
set "JDK_VER="
if "%~1"=="" exit /b 0
if not exist "%~1\bin\java.exe" exit /b 0
"%~1\bin\java.exe" -version 2>"%TEMP%\_probe_jdk_version.txt"
set "JDKLINE="
set /p JDKLINE=<"%TEMP%\_probe_jdk_version.txt"
del "%TEMP%\_probe_jdk_version.txt" >nul 2>nul
if not defined JDKLINE exit /b 0
REM 形如: openjdk version "17.0.20" 2026-07-21  →  第 3 个空格分隔字段，%%~a 去掉引号
for /f "tokens=3" %%a in ("!JDKLINE!") do set "JDK_VER=%%~a"
if not defined JDK_VER exit /b 0
for /f "tokens=1 delims=." %%a in ("!JDK_VER!") do set "PROBE_MAJOR=%%a"
exit /b 0
