@echo off

IF "%1"=="init" (
    echo "[JINI] Checking for Virtual Environment" 
    IF EXIST "venv" (
        echo "[JINI] Environment already exists. Skipping creation..."
    ) ELSE (
        echo "[JINI] Creating new venv (Python 3.10)..."
        py -3.10 -m venv venv
    )
    
    echo "[JINI] Updating/Installing Requirements..." 
    .\venv\Scripts\python.exe -m pip install -r "%~dp0config\requirements.txt"
    echo "[JINI] Initialization Complete" 
    
) ELSE IF "%1"=="run" (
    echo "[JINI] Starting FastAPI Server" 
    .\venv\Scripts\python.exe -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload 
) ELSE (
    echo "Usage: jini init OR jini run"
)