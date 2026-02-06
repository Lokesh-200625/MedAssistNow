@echo off
setlocal enabledelayedexpansion
title MedAss Infrastructure

echo Starting MedAss Infrastructure...
cd /d "%~dp0"

echo.
echo ===== Installing Node Modules =====
call npm install
if errorlevel 1 (
    echo npm install failed
    pause
    exit /b
)

echo.
echo ===== Waiting 2 seconds =====
timeout /t 2 >nul

echo.
echo ===== Checking Docker =====
docker info >nul 2>&1
if errorlevel 1 (
    echo Docker is not running
    pause
    exit /b
)

echo.
echo ===== Starting Docker Services =====
docker-compose up -d
if errorlevel 1 (
    echo Docker Compose failed
    pause
    exit /b
)

echo.
echo ===== Starting Node App =====
call npm start

echo.
echo ===== Script finished =====
pause
