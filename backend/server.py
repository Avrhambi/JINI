from fastapi import FastAPI
from routes.auth import auth_router
from config import db
from fastapi.middleware.cors import CORSMiddleware





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
# app.include_router(user_routes.router, prefix="/users", tags=["Users"])
# app.include_router(call_routes.router, prefix="/calls", tags=["Calls"])

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

#close connection to DB
@app.on_event("shutdown")
def shutdown_db_client():
    db.close_db()