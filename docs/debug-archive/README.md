# 调试产物归档

> 归档日期：2026-09-10
> 来源：项目根目录与 backend/ 目录历史调试遗留
> 目的：根目录保持整洁，便于作为可展示工程；本目录留档备查

## 归档文件

| 文件 | 原位置 | 说明 |
|------|--------|------|
| error1.png ~ error4.png | 根目录 | 历史运行错误截图（各约 2~3MB） |
| error_screenshot.png | 根目录 | 错误截图 |
| backend_error.png | 根目录 | 后端错误截图 |
| backend_error.log | 根目录 | 后端启动错误日志 |
| backend_start.log | 根目录 | 后端启动日志 |
| backend.log | backend/ | 后端运行日志 |
| backend-err.log | backend/ | 后端错误日志 |

## 编码检测结论（2026-09-10）

对 `docs/sql/01~05*.sql` 做了严格 UTF-8 round-trip 校验：**5 个文件均为合法 UTF-8，无需转码**。

此前"SQL 文件为 GBK 编码"的判断是 PowerShell 默认按 ANSI/GBK 解码 UTF-8 内容导致的**显示乱码**（mojibake），并非文件本身编码问题。已如实记录，供后续排查参考。
