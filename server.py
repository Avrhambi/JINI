from fastapi import FastAPI
from routes.user import user_router
from routes.auth import auth_router
from routes.call import call_router # Using the updated routes file
import config.db as db_config # Import your MongoDB configuration
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path    



app = FastAPI(title="JINI - Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user_router, prefix="/users", tags=["users"])
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(call_router, prefix="/calls", tags=["calls"]) 


@app.get("/")
async def root():
    return {"message": "JINI backend is running"}


# Check connection to DB and initialize collections
@app.on_event("startup")
def startup_db_client():
    try:
        db_config.init_db() # Use your provided initialization function
        db_config.client.admin.command("ping")
        print("✅ Connected to MongoDB!")
    except Exception as e:
        print("❌ Could not connect to MongoDB:", e)
        raise