@echo off
chcp 65001 >nul
echo ============================================
echo   校园数字孪生 WebGIS - 前端启动脚本
echo ============================================
echo.

cd /d "%~dp0frontend"

REM 检查 node_modules 是否存在
if not exist "node_modules" (
    echo [首次启动] 正在安装依赖...
    call npm install
    if errorlevel 1 (
        echo.
        echo [错误] npm install 失败，请检查 Node.js 是否安装
        pause
        exit /b 1
    )
    echo.
    echo [完成] 依赖安装成功
    echo.
)

echo ============================================
echo   正在启动前端开发服务器...
echo   访问地址: http://localhost:5173
echo ============================================
echo.

call npm run dev

pause
