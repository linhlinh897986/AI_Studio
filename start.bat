@echo off
title ViGen AIO Studio
echo ====================================================
echo      KHOI DONG VIGEN AIO STUDIO - DESKTOP APP
echo ====================================================
echo.

if not exist dist (
  echo Dang bien dich giao dien lan dau (Vui long cho giay lat)...
  call npm run build
)

echo Dang khoi chay ung dung...
echo (Vui long khong dong cua so nay khi dang su dung phan mem)
echo.

set NODE_ENV=production
call npx electron .
