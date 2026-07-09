@echo off
title ViGen AIO - Khoi Dong Nhanh
echo ====================================================
echo      KHOI DONG VIGEN AIO STUDIO - DESKTOP APP
echo ====================================================
echo.

echo [1/2] Dang khoi chay React Vite Server trong nen...
start /min cmd /c "call npm run dev"

echo Dang cho server khoi dong trong 4 giay...
timeout /t 4 /nobreak > NUL

echo [2/2] Dang khoi chay Electron Desktop App...
call npm run start

echo.
echo Da dong ung dung. Nhan nut bat ky de thoat...
pause > NUL
