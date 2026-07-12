@echo off
title ViGen AIO Studio
echo ====================================================
echo      KHOI DONG VIGEN AIO STUDIO - DESKTOP APP
echo ====================================================
echo.

if not exist dist (
  echo Dang bien dich giao dien lan dau (Vui long cho giay lat)...
  node node_modules\vite\bin\vite.js build
)

echo Dang khoi chay ung dung...
echo (Vui long khong dong cua so nay khi dang su dung phan mem)
echo.

set NODE_ENV=production
node node_modules\electron\cli.js .

if %errorlevel% neq 0 (
  echo.
  echo [LOI] Co loi xay ra khi khoi dong ung dung.
  pause
)
