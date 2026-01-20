@echo off
echo ========================================
echo   FitSense API Server Startup
echo ========================================
echo.

cd /d "%~dp0"

echo Checking Python installation...
python --version
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH!
    pause
    exit /b 1
)

echo.
echo Starting API server...
echo.
echo IMPORTANT: Keep this window open while using the app!
echo.
echo Your server will be available at:
echo   - Local: http://localhost:8000
echo   - Network: Check the IP address shown below
echo.
echo Press Ctrl+C to stop the server
echo.

python api.py

pause
