@echo off

IF "%1"=="init" (              
    echo "[SEARCH_ENGINE] Checking for Virtual Environment" 
    IF EXIST "venv" (
        echo "[SEARCH_ENGINE] Environment already exists. Skipping creation..."
    ) ELSE (
        echo [SEARCH_ENGINE] Creating venv..."
        python -m venv venv
    )

    echo "[SEARCH_ENGINE] Installing Requirements" 
    .\venv\Scripts\python.exe -m pip install -r requirements.txt
    echo "[SEARCH_ENGINE] Initialization Complete" 

) ELSE IF "%1"=="run" (
    echo "[SEARCH_ENGINE] Starting Server"
    .\venv\Scripts\python.exe server.py
) ELSE (
    echo "Usage: jini init OR jini run"`
)