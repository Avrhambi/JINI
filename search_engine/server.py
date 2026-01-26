# server.py
import os
import json
import time
import shutil
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from threading import Thread

# יבוא המבנים המעודכנים
from storage import Storage
from search_engine import SearchEngine
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)
# הגדרת CORS בצורה רחבה כדי למנוע חסימות דפדפן
CORS(app, resources={r"/*": {"origins": "*"}})

# ======================
# נתיבים (Paths)
# ======================
BASE_PATH = r"H:\My Drive\HebrewAudioSearch"
UPLOADS_DIR = os.path.join(BASE_PATH, "uploads")
INDEX_DIR = os.path.join(BASE_PATH, "index")
AUDIO_DIR = os.path.join(BASE_PATH, "processed_audio") 

# וידוא קיום תיקיות בסיסיות
for path in [UPLOADS_DIR, INDEX_DIR, AUDIO_DIR]:
    if not os.path.exists(path):
        os.makedirs(path)
        print(f"📁 Created base directory: {path}")

# ======================
# אתחול רכיבים
# ======================
print("⏳ Loading mongo DB...")
storage = Storage(mongo_uri="mongodb://localhost:27017")
print("⏳ Loading Embedding Model...")
embedder = SentenceTransformer("intfloat/multilingual-e5-large")
query_llm = "gemini-2.0-flash"
search_llm = "gemini-2.5-flash"
query_agent_api_key = os.getenv("FLASH_2_API_KEY")
search_agent_api_key = os.getenv("FLASH_2.5_API_KEY")


search_engine = SearchEngine(
    storage, 
    embedder, 
    query_agent_api_key=query_agent_api_key,
    search_agent_api_key=search_agent_api_key,
    query_model_name=query_llm,
    search_model_name=search_llm
    )

# ======================
# Index Watcher (סנכרון מול ה-Colab)
# ======================
def index_watcher():
    """סורק את תיקיית האינדקס ומעדכן את ה-DB במידע שהגיע מה-Colab Worker"""
    print("👀 Index Watcher started...")
    while True:
        try:
            if not os.path.exists(INDEX_DIR):
                time.sleep(10)
                continue


                
            json_files = [f for f in os.listdir(INDEX_DIR) if f.endswith(".json")]
            for f in json_files:
                path = os.path.join(INDEX_DIR, f)
                
                try:
                    os.rename(path, path)
                except OSError:
                    continue

                try:
                    with open(path, "r", encoding="utf-8") as jf:
                        data = json.load(jf)
                    
                    # שמירה ב-Storage כולל ה-user_id שהוזרק ע"י ה-Colab
                    storage.save_windows(
                        file_name=data["file_name"],
                        blocks=data["windows"],
                        embeddings=data["embeddings"],
                        full_transcript=data["full_transcript"],
                        user_id=data.get("user_id", "default_user")
                    )
                    
                    # מחיקת קובץ ה-JSON כדי לא לעבד אותו שוב
                    os.remove(path)
                    print(f"📦 Successfully indexed: {data['file_name']} for user: {data.get('user_id')}")
                except Exception as e:
                    print(f"❌ Error processing index file {f}: {e}")
        except Exception as e:
            print(f"❌ Watcher error: {e}")
        time.sleep(10) # בדיקה כל 10 שניות

# הפעלת ה-Watcher ברקע
Thread(target=index_watcher, daemon=True).start()

# ======================
# API Routes
# ======================

@app.route('/upload', methods=['POST'])
def upload_audio():
    """העלאת קובץ ויצירת תיקיית משתמש במידת הצורך"""
    try:
        user_id = request.form.get('user_id')
        file = request.files.get('file')
        
        if not user_id or not file:
            return jsonify({"error": "Missing user_id or file"}), 400

        # יצירת תיקייה ייעודית למשתמש בתוך uploads (בידוד נתונים)
        user_upload_dir = os.path.join(UPLOADS_DIR, user_id)
        if not os.path.exists(user_upload_dir):
            os.makedirs(user_upload_dir)
        
        file_path = os.path.join(user_upload_dir, file.filename)
        file.save(file_path)
        print(f"📥 Received file from User {user_id}: {file.filename}")

        # מנגנון Polling: ננסה לבדוק אם התמלול מוכן כדי להחזיר תשובה מהירה
        for _ in range(120):  # המתנה של עד 60 שניות (12 פעמים * 5 שניות)
            time.sleep(10)
            transcript = storage.get_full_transcript(file.filename, user_id)
            if transcript:
                return jsonify({
                    "status": "success",
                    "file_name": file.filename,
                    "transcript": transcript
                }), 200
        
        # אם עבר זמן והתמלול לא מוכן, נחזיר סטטוס "בעיבוד"
        return jsonify({"error": "Timeout - processing took too long"}), 408

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/search', methods=['GET'])
def search():
    """חיפוש סמנטי וטקסטואלי מבודד לפי user_id"""
    query = request.args.get('q')
    user_id = request.args.get('user_id')
    
    if not query or not user_id:
        return jsonify({"error": "Missing query or user_id"}), 400
        
    # שליחת השאילתה למנוע החיפוש עם סינון המשתמש
    results = search_engine.search(query, user_id=user_id)
    return jsonify({"results": results})

@app.route('/transcript/<user_id>/<filename>', methods=['GET'])
def get_transcript(user_id, filename):
    """שליפת תמלול מלא של קובץ מסוים השייך למשתמש"""
    transcript = storage.get_full_transcript(filename, user_id)
    if transcript:
        return jsonify({"transcript": transcript})
    return jsonify({"error": "Transcript not found or access denied"}), 404

@app.route('/audio/<user_id>/<filename>')
def serve_audio(user_id, filename):
    """הגשת קובץ האודיו מהתיקייה המעובדת של המשתמש"""
    user_audio_dir = os.path.join(AUDIO_DIR, user_id)
    if not os.path.exists(os.path.join(user_audio_dir, filename)):
        return jsonify({"error": "Audio file not found"}), 404
    return send_from_directory(user_audio_dir, filename)

