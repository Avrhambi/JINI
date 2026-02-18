from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware # Added for speed
from fastapi.responses import ORJSONResponse # Added for speed
from contextlib import asynccontextmanager # Added for better startup
from routes.user import user_router
from routes.auth import auth_router
from routes.call import call_router
import config.db as db_config


# 1. Lifespan handles startup and shutdown cleanly
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        db_config.init_db()
        print("✅ Connected to MongoDB via Connection Pool")
    except Exception as e:
        print("❌ Could not connect to MongoDB:", e)
    yield
    db_config.close_db()

# 2. Use ORJSONResponse as default for faster data encoding
app = FastAPI(
    title="JINI - Backend", 
    default_response_class=ORJSONResponse,
    lifespan=lifespan
)

# 3. Compress responses over 1000 bytes 
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(user_router, prefix="/users", tags=["users"])
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(call_router, prefix="/calls", tags=["calls"]) 

@app.get("/")
async def root():
    return {"message": "JINI backend is running"}



# from fastapi import FastAPI
# from routes.user import user_router
# from routes.auth import auth_router
# from routes.call import call_router # Using the updated routes file
# import config.db as db_config # Import your MongoDB configuration
# from fastapi.middleware.cors import CORSMiddleware
  



# app = FastAPI(title="JINI - Backend")

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# app.include_router(user_router, prefix="/users", tags=["users"])
# app.include_router(auth_router, prefix="/auth", tags=["auth"])
# app.include_router(call_router, prefix="/calls", tags=["calls"]) 


# @app.get("/")
# async def root():
#     return {"message": "JINI backend is running"}


# # Check connection to DB and initialize collections
# @app.on_event("startup")
# def startup_db_client():
#     try:
#         db_config.init_db() # Use your provided initialization function
#         db_config.client.admin.command("ping")
#         print("✅ Connected to MongoDB!")
#     except Exception as e:
#         print("❌ Could not connect to MongoDB:", e)
#         raise