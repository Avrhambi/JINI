from fastapi import FastAPI, Depends
from routes.auth import auth_router
from routes.call import call_router
from config import db
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from middleware.auth import verify_token



UPLOAD_DIR = Path("audios")
UPLOAD_DIR.mkdir(exist_ok=True)

# start the server
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or restrict to your frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(call_router, prefix="/calls", tags=["Calls"])
# app.include_router(user_routes.router, prefix="/users", tags=["Users"])



# @app.get("/test/protected_request")
# def protected_request(user=Depends(verify_token)):
#     return {"message": "Protected request successful ✅", "user": {"id": user.id, "email": user.email}}
 

@app.get("/")
async def root():
    return {"message": "Hello JINI Backend!"}


#check connection to DB
@app.on_event("startup")
def startup_db_client():
    try:
        db.init_db()
        db.client.admin.command("ping")   #ping to Db
        print("✅ Connected to MongoDB!")
    except Exception as e:
        print("❌ Could not connect to MongoDB:", e)
        raise

# #close connection to DB
# @app.on_event("shutdown")
# def shutdown_db_client():
#     db.close_db()