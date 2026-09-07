# config/db.py
import os
from pymongo import MongoClient, ASCENDING
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")

client = None
db = None
users_collection = None
calls_collection = None


def init_db():
    global client, db, users_collection, calls_collection
    client = MongoClient(
        MONGO_URI, 
        serverSelectionTimeoutMS=5000,
        minPoolSize=10,
        maxPoolSize=50,
        connect=True
    )
    db = client["JINI"]

    # collections
    users_collection = db["users"]
    calls_collection = db["calls"]

    # indexes
    users_collection.create_index([("email", ASCENDING)], unique=True)

    
def close_db():
    global client
    if client:
        client.close()
        print("🔌 MongoDB connection closed")
