@echo off
echo Starting MedAss Infrastructure...

:: Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo Docker is not running. Please start Docker Desktop and try again.
    pause
    exit /b
)

:: Run Docker Compose
echo Docker is running. Starting services...
docker-compose up -d

if %errorlevel% neq 0 (
    echo Failed to start services. Please check the error message above.
    pause
    exit /b
)

echo.
echo ====================================================
echo Services Started Successfully!
echo ====================================================
echo Redis: localhost:6379
echo RabbitMQ Console: http://localhost:15672 (guest/guest)
echo Elasticsearch: http://localhost:9200
echo Prometheus: http://localhost:9090
echo ====================================================
echo.
pause
