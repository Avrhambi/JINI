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



# # ======================
# # מנגנון סנכרון אוטומטי (Index Watcher)
# # ======================

# def index_watcher():
#     print("👀 Index Watcher started...")
#     processed_dir = os.path.join(INDEX_DIR, "processed")
#     if not os.path.exists(processed_dir): 
#         os.makedirs(processed_dir)

#     while True:
#         try:
#             if os.path.exists(INDEX_DIR):
#                 files = [f for f in os.listdir(INDEX_DIR) if f.endswith(".json")]
#                 for file_name in files:
#                     file_path = os.path.join(INDEX_DIR, file_name)
#                     dest_path = os.path.join(processed_dir, file_name)

#                     try:
#                         os.rename(file_path, file_path)
#                     except OSError:
#                         continue 

#                     try:
#                         with open(file_path, 'r', encoding='utf-8') as f:
#                             data = json.load(f)
#                             target_audio_name = data.get("file_name")
#                             full_transcript = data.get("full_transcript", "")
#                     except json.JSONDecodeError:
#                         continue

#                     print(f"📥 Processing new index: {target_audio_name}")
#                     storage.save_windows(
#                         target_audio_name, 
#                         data["windows"], 
#                         data["embeddings"],
#                         full_transcript
#                     )
                    
#                     try:
#                         if os.path.exists(dest_path): os.remove(dest_path)
#                         shutil.move(file_path, dest_path)
#                         print(f"✅ Successfully indexed: {target_audio_name}")
#                     except Exception as move_err:
#                         print(f"⚠️ Move delayed: {move_err}")

#         except Exception as e:
#             print(f"❌ Error in Index Watcher: {e}")
            
#         time.sleep(10)

# Thread(target=index_watcher, daemon=True).start()

# # ======================
# # API Routes
# # ======================

# @app.route('/upload', methods=['POST'])
# def upload_audio():
#     """הפונקציה שהייתה חסרה - מקבלת את הקובץ מה-Frontend"""
#     try:
#         if 'file' not in request.files:
#             return jsonify({"error": "No file part"}), 400
        
#         file = request.files['file']
#         if file.filename == '':
#             return jsonify({"error": "No selected file"}), 400

#         if file and file.filename.lower().endswith('.wav'):
#             file_path = os.path.join(UPLOADS_DIR, file.filename)
#             file.save(file_path)
#             print(f"📁 File saved to Drive: {file.filename}")
#             return jsonify({"message": "הקובץ הועלה בהצלחה לדרייב. העיבוד ב-Colab יתחיל בקרוב."}), 200
        
#         return jsonify({"error": "נא להעלות קובץ WAV בלבד"}), 400
#     except Exception as e:
#         print(f"❌ Upload error: {e}")
#         return jsonify({"error": str(e)}), 500

# @app.route('/search', methods=['GET'])
# def search():
#     query = request.args.get('q')
#     if not query:
#         return jsonify({"results": []})
#     results = search_engine.search(query)
#     return jsonify({"results": results})

# @app.route('/transcript/<filename>', methods=['GET'])
# def get_transcript(filename):
#     transcript = storage.get_full_transcript(filename)
#     if transcript:
#         return jsonify({"file_name": filename, "full_transcript": transcript})
#     return jsonify({"error": "Transcript not found"}), 404

# @app.route('/audio/<filename>')
# def serve_audio(filename):
#     # הגנה מפני נתיבים לא חוקיים
#     filename = os.path.basename(filename)
#     if not filename.lower().endswith('.wav'):
#         filename += '.wav'
#     return send_from_directory(AUDIO_DIR, filename, mimetype="audio/wav")

# @pp.route('/status', methods=['GET'])a
# def get_status():
#     try:
#         total_blocks = storage.collection.count_documents({})
#         total_files = storage.files_collection.count_documents({})
#         faiss_count = storage.index.ntotal
        
#         return jsonify({
#             "total_semantic_blocks": total_blocks,
#             "total_files_in_db": total_files,
#             "faiss_index_size": faiss_count,
#             "status": "online"
#         })
#     except Exception as e:
#         return jsonify({"error": str(e), "status": "error"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)


# import os
# import json
# import time
# import re
# import shutil
# from flask import Flask, request, jsonify, send_from_directory
# from flask_cors import CORS
# from threading import Thread # להרצת הסנכרון ברקע


# # יבוא המבנים שיצרנו
# from storage import Storage
# from search_engine import SearchEngine
# from sentence_transformers import SentenceTransformer


# app = Flask(__name__)
# CORS(app)

# # ======================
# # נתיבים (Paths) - עדכן לפי הנתיב המקומי של הדרייב אצלך
# # ======================
# BASE_PATH = r"H:\My Drive\HebrewAudioSearch"
# UPLOADS_DIR = os.path.join(BASE_PATH, "uploads")
# INDEX_DIR = os.path.join(BASE_PATH, "index")
# AUDIO_DIR = os.path.join(BASE_PATH, "processed_audio") 

# # ======================
# # אתחול
# # ======================
# storage = Storage(mongo_uri="mongodb://localhost:27017")
# embedder = SentenceTransformer("intfloat/multilingual-e5-large")
# # model_name = "gemini-2.0-flash-exp"
# llm_name = "gemini-2.0-flash"
# # llm_name = "gemini-2.5-flash"
# search_engine = SearchEngine(storage, embedder, api_key="AIzaSyAsrhw2SCQ32JKGNR_b4cQ-6j4su-Y52jo", model_name=llm_name)

# # ======================
# # מנגנון סנכרון אוטומטי (Index Watcher)
# # ======================


# def index_watcher():
#     print("👀 Index Watcher started...")
#     processed_dir = os.path.join(INDEX_DIR, "processed")
#     if not os.path.exists(processed_dir): 
#         os.makedirs(processed_dir)

#     while True:
#         try:
#             if os.path.exists(INDEX_DIR):
#                 # קבלת רשימת הקבצים ומיון לפי זמן (הישנים קודם)
#                 files = [f for f in os.listdir(INDEX_DIR) if f.endswith(".json")]
                
#                 for file_name in files:
#                     file_path = os.path.join(INDEX_DIR, file_name)
#                     dest_path = os.path.join(processed_dir, file_name)

#                     # --- שלב בדיקת המוכנות (Ready Check) ---
#                     try:
#                         # בדיקה אם הקובץ נעול על ידי מערכת ההפעלה/Google Drive
#                         # נסיון לשנות את השם לעצמו - אם נכשל, הקובץ בשימוש
#                         os.rename(file_path, file_path)
                        
#                         # בדיקה שהקובץ לא ריק וגודלו יציב
#                         initial_size = os.path.getsize(file_path)
#                         if initial_size == 0: continue 
                        
#                     except OSError:
#                         # הקובץ נעול או בתהליך הורדה - נדלג עליו וננסה בסיבוב הבא
#                         continue 

#                     # 1. קריאת הנתונים בבטחה
#                     try:
#                         with open(file_path, 'r', encoding='utf-8') as f:
#                             data = json.load(f)
#                             target_audio_name = data.get("file_name")
#                     except json.JSONDecodeError:
#                         # אם הקובץ פגום או לא סיים להיכתב, נדלג עליו
#                         continue

#                     # 2. בדיקה אם כבר ב-DB (מניעת כפילויות)
#                     if storage.collection.find_one({"file_name": target_audio_name}):
#                         print(f"⏩ {target_audio_name} already in DB.")
#                     else:
#                         print(f"📥 Importing new index: {file_name}")
#                         storage.save_windows(target_audio_name, data["windows"], data["embeddings"])
#                         print(f"✅ Successfully indexed: {file_name}")

#                     # 3. העברה לתיקיית processed
#                     try:
#                         if os.path.exists(dest_path): os.remove(dest_path)
#                         shutil.move(file_path, dest_path)
#                     except Exception as move_err:
#                         print(f"⚠️ Move delayed (Drive lock): {move_err}")

#         except Exception as e:
#             print(f"❌ Error in Index Watcher: {e}")
            
#         time.sleep(15) # המתנה כללית בין סריקות התיקייה
# # הפעלת הסורק ב-Thread נפרד כדי שלא יחסום את ה-API
# Thread(target=index_watcher, daemon=True).start()

# # ======================
# # API Routes
# # ======================

# @app.route('/upload', methods=['POST'])
# def upload_audio():
#     file = request.files.get('file')
#     if file and file.filename.lower().endswith('.wav'):
#         file.save(os.path.join(UPLOADS_DIR, file.filename))
#         return jsonify({"message": "Uploaded to Drive. Processing will start in Colab."}), 200
#     return jsonify({"error": "Invalid file"}), 400

# @app.route('/search', methods=['GET'])
# def search():
#     query = request.args.get('q')
#     results = search_engine.search(query)
#     return jsonify({"results": results})

# @app.route('/audio/<filename>')
# def serve_audio(filename):
#     if not filename.lower().endswith('.wav'):
#         filename += '.wav'
#     return send_from_directory(AUDIO_DIR, filename, mimetype="audio/wav")


# @app.route('/status', methods=['GET'])
# def get_status():
#     try:
#         # ספירת מסמכים ב-MongoDB
#         total_windows = storage.collection.count_documents({})
#         # ספירת קבצים ייחודיים
#         total_files = len(storage.collection.distinct("file_name"))
#         # בדיקה כמה וקטורים יש ב-FAISS
#         faiss_count = storage.index.ntotal
        
#         return jsonify({
#             "total_windows": total_windows,
#             "total_files": total_files,
#             "faiss_size": faiss_count,
#             "status": "online"
#         })
#     except Exception as e:
#         return jsonify({"error": str(e), "status": "error"}), 500


# if __name__ == '__main__':
#     # מומלץ להריץ ב-Debug במוד פיתוח
#     app.run(host='0.0.0.0', port=5000, debug=False)




# def index_watcher():
#     print("👀 Index Watcher started...")
#     processed_dir = os.path.join(INDEX_DIR, "processed")
#     if not os.path.exists(processed_dir): 
#         os.makedirs(processed_dir)

#     while True:
#         try:
#             if os.path.exists(INDEX_DIR):
#                 for file_name in os.listdir(INDEX_DIR):
#                     if file_name.endswith(".json"):
#                         file_path = os.path.join(INDEX_DIR, file_name)
#                         dest_path = os.path.join(processed_dir, file_name)

#                         # 1. קריאת שם הקובץ מתוך ה-JSON לבדיקת כפילות
#                         with open(file_path, 'r', encoding='utf-8') as f:
#                             data = json.load(f)
#                             target_audio_name = data.get("file_name")

#                         # 2. בדיקה אם הקובץ כבר קיים ב-MongoDB
#                         if storage.collection.find_one({"file_name": target_audio_name}):
#                             print(f"⏩ {target_audio_name} already in DB. Moving to processed...")
#                         else:
#                             # 3. ייבוא רק אם לא קיים
#                             print(f"📥 Importing new index: {file_name}")
#                             storage.save_windows(target_audio_name, data["windows"], data["embeddings"])
#                             print(f"✅ Successfully indexed: {file_name}")

#                         # 4. העברה לתיקיית processed (בכל מקרה, כדי לנקות את תיקיית האינדקס)
#                         try:
#                             time.sleep(1) # הגנה מנעילת קובץ ב-Windows
#                             if os.path.exists(dest_path): 
#                                 os.remove(dest_path)
#                             shutil.move(file_path, dest_path)
#                         except Exception as move_err:
#                             print(f"⚠️ Move failed (locked): {move_err}")

#         except Exception as e:
#             print(f"❌ Error in Index Watcher: {e}")
            
#         time.sleep(15)
# def index_watcher():
#     """סורק את תיקיית ה-index ומעלה קבצים חדשים ל-MongoDB"""
#     print("👀 Index Watcher started...")
#     while True:
#         try:
#             if not os.path.exists(INDEX_DIR):
#                 os.makedirs(INDEX_DIR)
                
#             for file_name in os.listdir(INDEX_DIR):
#                 if file_name.endswith(".json"):
#                     file_path = os.path.join(INDEX_DIR, file_name)
                    
#                     print(f"📥 Found new index file: {file_name}. Importing...")
#                     with open(file_path, 'r', encoding='utf-8') as f:
#                         data = json.load(f)
                        
#                         # שליפת השדות לפי המבנה החדש מה-Worker
#                         file_name = data.get("file_name")
#                         windows = data.get("windows")
#                         embeddings = data.get("embeddings") # הרשימה הנפרדת של הוקטורים
                        
#                         storage.save_windows(file_name, windows, embeddings)

#                     # לאחר הייבוא, נעביר את הקובץ לתיקיית 'processed' כדי לא לייבא שוב
#                     processed_dir = os.path.join(INDEX_DIR, "processed")
#                     if not os.path.exists(processed_dir): os.makedirs(processed_dir)
#                     os.rename(file_path, os.path.join(processed_dir, file_name))
#                     print(f"✅ Successfully indexed {file_name}")
                    
#         except Exception as e:
#             print(f"❌ Error in Index Watcher: {e}")
            
#         time.sleep(30) # סריקה כל 30 שניות
# def index_watcher():
#     """סורק את תיקיית ה-index ומעלה קבצים חדשים ל-MongoDB"""
#     print("👀 Index Watcher started...")
#     processed_dir = os.path.join(INDEX_DIR, "processed")
#     if not os.path.exists(processed_dir): 
#         os.makedirs(processed_dir)

#     while True:
#         try:
#             if os.path.exists(INDEX_DIR):
#                 for actual_file in os.listdir(INDEX_DIR):
#                     if actual_file.endswith(".json"):
#                         file_path = os.path.join(INDEX_DIR, actual_file)
                        
#                         print(f"📥 Found new index file: {actual_file}. Importing...")
#                         with open(file_path, 'r', encoding='utf-8') as f:
#                             data = json.load(f)
                            
#                             # שליפת נתונים - שימוש בשמות משתנים ברורים
#                             target_file_name = data.get("file_name")
#                             windows = data.get("windows")
#                             embeddings = data.get("embeddings")
                            
#                             # וידוא שכל הנתונים קיימים לפני שמירה
#                             if windows and embeddings:
#                                 storage.save_windows(target_file_name, windows, embeddings)
                                
#                                 # העברה לתיקיית processed רק אחרי הצלחה בשמירה
#                                 target_path = os.path.join(processed_dir, actual_file)
#                                 # טיפול במקרה שהקובץ כבר קיים ב-processed (מחיקת ישן)
#                                 if os.path.exists(target_path):
#                                     os.remove(target_path)
#                                 os.rename(file_path, target_path)
#                                 print(f"✅ Successfully indexed {actual_file}")
#                             else:
#                                 print(f"⚠️ Warning: {actual_file} missing data fields.")

#         except Exception as e:
#             print(f"❌ Error in Index Watcher: {e}")
            
#         time.sleep(30)


# def index_watcher():
#     print("👀 Index Watcher started...")
#     processed_dir = os.path.join(INDEX_DIR, "processed")
#     if not os.path.exists(processed_dir): 
#         os.makedirs(processed_dir)

#     while True:
#         try:
#             if os.path.exists(INDEX_DIR):
#                 for file_name in os.listdir(INDEX_DIR):
#                     if file_name.endswith(".json"):
#                         file_path = os.path.join(INDEX_DIR, file_name)
#                         dest_path = os.path.join(processed_dir, file_name)
                        
#                         # 1. קריאת הנתונים
#                         with open(file_path, 'r', encoding='utf-8') as f:
#                             data = json.load(f)
                        
#                         # 2. שמירה ל-DB
#                         storage.save_windows(data["file_name"], data["windows"], data["embeddings"])
                        
#                         # 3. סגירת הקובץ וניסיון העברה עם הגנה
#                         try:
#                             # השהיה קטנה כדי לתת ל-Windows/Google Drive לשחרר את הנעילה
#                             time.sleep(1) 
#                             dest_path = os.path.join(processed_dir, file_name)
#                             if os.path.exists(dest_path): os.remove(dest_path)
#                             shutil.move(file_path, dest_path)
#                             print(f"✅ Successfully moved and indexed: {file_name}")
#                         except Exception as move_error:
#                             print(f"⚠️ Could not move file (Drive lock), will retry: {move_error}")
#         except Exception as e:
#             print(f"❌ Error in Index Watcher: {e}")
            
#         time.sleep(15)




# from flask import Flask, request, jsonify
# from flask_cors import CORS
# from flask import send_from_directory
# from storage import Storage
# from search_engine import SearchEngine
# from sentence_transformers import SentenceTransformer
# from google import genai
# import os


# app = Flask(__name__)
# CORS(app) # מאפשר גישה מה-Frontend

# # ======================
# # Configuration
# # ======================
# MONGO_URI = "mongodb://localhost:27017" # עדכן בהתאם לסביבה שלך
# GEMINI_API_KEY = "AIzaSyAsrhw2SCQ32JKGNR_b4cQ-6j4su-Y52jo"
# EMBEDDING_MODEL_NAME = "intfloat/multilingual-e5-large"
# AUDIO_DIRECTORY = os.path.join(os.getcwd(), "uploads")

# # ======================
# # Initialization
# # ======================

# # 1. טעינת המודל הסמנטי (E5)
# print("🧠 Loading Embedding Model...")
# embedder = SentenceTransformer(EMBEDDING_MODEL_NAME)

# # 2. חיבור ל-Storage (MongoDB + FAISS)
# print("💾 Connecting to Storage...")
# storage = Storage(mongo_uri=MONGO_URI)

# # 3. אתחול מנוע החיפוש עם ה-SDK החדש של Google
# print("🚀 Initializing Search Engine...")
# # שימוש ב-SearchEngine שיצרנו עם ה-Agentic Reranking
# search_engine = SearchEngine(
#     storage=storage, 
#     embedder=embedder, 
#     api_key=GEMINI_API_KEY,
#     model_name="gemini-2.0-flash-exp"
# )

# # ======================
# # API Endpoints
# # ======================

# @app.route('/search', methods=['GET'])
# def search():
#     query = request.args.get('q')
#     if not query:
#         return jsonify({"error": "No query provided"}), 400

#     try:
#         # הפעלת החיפוש ההיברידי + הדירוג של Gemini
#         results = search_engine.search(query, top_k=5)
        
#         # בניית תגובה מסודרת
#         formatted_results = []
#         for res in results:
#             formatted_results.append({
#                 "text": res["text"],
#                 "start_time": res["start"],
#                 "score": res["score"],
#                 "reasoning": res["reasoning"],
#                 "file_name": res["file_name"]
#             })
            
#         return jsonify({
#             "query": query,
#             "results_count": len(formatted_results),
#             "results": formatted_results
#         })

#     except Exception as e:
#         print(f"Search Error: {e}")
#         return jsonify({"error": "Internal server error"}), 500

# @app.route('/audio/<filename>')
# def serve_audio(filename):
#     """מגיש את קובץ ה-WAV לדפדפן"""
#     # mimetype="audio/wav" מבטיח שהדפדפן יפתח נגן ולא יוריד את הקובץ
#     return send_from_directory(AUDIO_DIRECTORY, filename, mimetype="audio/wav")


# # app.py
# import streamlit as st
# import os
# from search_engine import SearchEngine

# # נתיבים לכונן ה-Google Drive Desktop (שנה במידת הצורך)
# DRIVE_INDEX = r"G:\My Drive\HebrewAudioSearch\index"
# DRIVE_UPLOADS = r"G:\My Drive\HebrewAudioSearch\uploads"

# st.set_page_config(page_title="JINI - Hebrew Audio Search", layout="wide")

# @st.cache_resource
# def init_engine():
#     # המנוע משתמש ב-MongoDB מקומי
#     engine = SearchEngine(DRIVE_INDEX)
#     engine.storage.load_faiss() # טעינה ראשונית מה-DB
#     return engine

# engine = init_engine()

# # --- Sidebar ---
# with st.sidebar:
#     st.header("📤 העלאת קובץ")
#     up_file = st.file_uploader("בחר אודיו", type=['mp3', 'wav', 'm4a'])
#     if up_file and st.button("שלח לעיבוד ב-Colab"):
#         with open(os.path.join(DRIVE_UPLOADS, up_file.name), "wb") as f:
#             f.write(up_file.getbuffer())
#         st.success("הקובץ נשלח לדרייב!")

#     st.divider()
#     if st.button("🔄 סנכרן דרייב ל-DB מקומי"):
#         with st.spinner("מעדכן DB ו-FAISS..."):
#             added = engine.storage.sync_drive_to_db()
#             total = engine.storage.load_faiss()
#             st.success(f"נוספו {added} קבצים. סה\"כ ב-DB: {total}")

# # --- Main UI ---
# st.title("🔎 חיפוש היברידי (Exact + Semantic)")
# query = st.text_input("מה ברצונך למצוא?")
# # app.py - קטע החיפוש המעודכן
# if query:
#     results = engine.search(query)
    
#     if not results:
#         st.info("לא נמצאו תוצאות העומדות בסף הרלוונטיות.")
#     else:
#         for r in results:
#             with st.container(border=True):
#                 col1, col2 = st.columns([0.8, 0.2])
#                 with col1:
#                     st.write(f"📍 **זמן:** {int(r['start'] // 60):02d}:{int(r['start'] % 60):02d}")
#                     st.write(f"**ANCHOR:** {r['anchor_text']}")
                    
#                     with st.expander("ראה הקשר מלא (CONTEXT)"):
#                         st.info(r["window_text"])
#                         st.caption(f"סוג: {r['origin']} | קובץ: {r.get('file_id')}")
                
#                 with col2:
#                     st.metric("Score", f"{r['final_score']:.1f}")
                
#                 audio_path = f"uploads/{r.get('file_id')}.waw"
#                 if os.path.exists(audio_path):
#                     st.audio(audio_path, start_time=int(r['start']))

# # if query:
# #     results = engine.search(query)
# #     for r in results:
# #         with st.container(border=True):
# #             col1, col2 = st.columns([0.8, 0.2])
# #             with col1:
# #                 st.write(f"**טקסט:** {r['anchor_text']}")
# #                 st.caption(f"📁 {r.get('file_id', 'Unknown')} | סוג חיפוש: {r['origin']}")
# #             with col2:
# #                 st.metric("Score", f"{r['final_score']:.1f}")
            
# #             audio_path = os.path.join(DRIVE_UPLOADS, f"{r.get('file_id', '')}.mp3")
# #             # בדיקת קיום קובץ להשמעה
# #             if os.path.exists(audio_path):
# #                 st.audio(audio_path, start_time=int(r["start"]))

# # # app.py
# # import streamlit as st
# # import os
# # import shutil
# # from search_engine import SearchEngine

# # # הגדרות נתיבים (ודא שזה תואם לכונן ה-Drive שלך)
# # LOCAL_DRIVE_INDEX = r"G:\My Drive\HebrewAudioSearch\index"
# # LOCAL_DRIVE_AUDIO = r"G:\My Drive\HebrewAudioSearch\uploads"

# # st.set_page_config(page_title="Hebrew Audio Search", page_icon="🎙️", layout="wide")

# # @st.cache_resource
# # def get_engine(index_path):
# #     engine = SearchEngine(index_path)
# #     if os.path.exists(index_path):
# #         engine.storage.load_all()
# #     return engine

# # engine = get_engine(LOCAL_DRIVE_INDEX)

# # st.title("🎙️ חיפוש חכם בהקלטות")

# # # --- אזור העלאת קבצים ---
# # with st.sidebar:
# #     st.header("📤 העלאת הקלטה חדשה")
# #     uploaded_file = st.file_uploader("בחר קובץ אודיו", type=['mp3', 'wav', 'm4a'])
    
# #     if uploaded_file is not None:
# #         if st.button("שלח לעיבוד ב-Colab"):
# #             # יצירת נתיב היעד בתיקיית ה-uploads בדרייב
# #             dest_path = os.path.join(LOCAL_DRIVE_AUDIO, uploaded_file.name)
            
# #             # שמירת הקובץ לדרייב המקומי (שיסונכרן לענן)
# #             with open(dest_path, "wb") as f:
# #                 f.write(uploaded_file.getbuffer())
            
# #             st.success(f"הקובץ '{uploaded_file.name}' הועלה לדרייב. ה-Worker ב-Colab יתחיל לעבד אותו בקרוב.")

# #     st.divider()
# #     st.header("⚙️ ניהול אינדקס")
# #     if st.button("🔄 רענן נתונים (Sync)"):
# #         with st.spinner("סורק קבצים חדשים..."):
# #             count = engine.storage.load_all()
# #             st.success(f"נטענו {count} מקטעים מאונדקסים!")

# # # --- אזור החיפוש ---
# # query = st.text_input("מה אתם מחפשים לשמוע?", placeholder="למשל: 'מי דיבר על המנכ''ל?'")

# # if query:
# #     with st.spinner("מנתח רלוונטיות..."):
# #         results = engine.search(query)
    
# #     if not results:
# #         st.warning("לא נמצאו תוצאות.")
    
# #     for r in results:
# #         with st.container(border=True):
# #             col1, col2 = st.columns([0.8, 0.2])
# #             with col1:
# #                 st.subheader(f"📍 זמן: {int(r['start'] // 60):02d}:{int(r['start'] % 60):02d}")
# #                 st.write(r['anchor_text'])
# #                 st.caption(f"📁 קובץ: {r['file_name']}")
# #             with col2:
# #                 st.metric("Score", f"{r['score']:.1f}")
            
# #             audio_path = os.path.join(LOCAL_DRIVE_AUDIO, r['file_name'])
# #             if os.path.exists(audio_path):
# #                 st.audio(audio_path, start_time=int(r['start']))

# # # # app.py
# # # import streamlit as st
# # # import os
# # # from search_engine import SearchEngine

# # # # ==========================================
# # # # הגדרות נתיבים - התאם לפי האות של כונן ה-Drive אצלך
# # # # ==========================================
# # # # הנתיב שבו ה-Worker ב-Colab שומר את ה-JSON-ים
# # # LOCAL_DRIVE_INDEX = r"G:\My Drive\HebrewAudioSearch\index"
# # # # הנתיב שבו נמצאים קבצי האודיו המקוריים
# # # LOCAL_DRIVE_AUDIO = r"G:\My Drive\HebrewAudioSearch\uploads"

# # # st.set_page_config(
# # #     page_title="Hebrew Audio Search",
# # #     page_icon="🎙️",
# # #     layout="wide"
# # # )

# # # # שימוש ב-cache_resource כדי לא לטעון את המודלים מחדש בכל לחיצה
# # # @st.cache_resource
# # # def get_engine(index_path):
# # #     # יצירת מנוע החיפוש
# # #     engine = SearchEngine(index_path)
# # #     # טעינה ראשונית של כל הנתונים הקיימים בתיקייה
# # #     if os.path.exists(index_path):
# # #         engine.storage.load_all()
# # #     return engine

# # # # אתחול המנוע
# # # engine = get_engine(LOCAL_DRIVE_INDEX)

# # # # --- ממשק משתמש ---
# # # st.title("🎙️ חיפוש חכם בהקלטות (Hybrid Search)")
# # # st.markdown("מערכת המשלבת חיפוש סמנטי (FAISS) עם שיפוט בינה מלאכותית (Gemini) למציאת רגעים מדויקים.")

# # # with st.sidebar:
# # #     st.header("⚙️ ניהול אינדקס")
# # #     if st.button("🔄 רענן נתונים מהדרייב"):
# # #         # פקודה לטעינה מחדש של קבצי ה-JSON שסונכרנו מה-Colab
# # #         with st.spinner("סורק קבצים חדשים..."):
# # #             count = engine.storage.load_all()
# # #             st.success(f"נטענו {count} מקטעי טקסט מאונדקסים!")
    
# # #     st.divider()
# # #     st.info("""
# # #     **איך זה עובד?**
# # #     1. ה-Worker ב-Colab מעבד את האודיו.
# # #     2. ה-JSON מסתנכרן למחשב דרך Google Drive.
# # #     3. האפליקציה כאן קוראת את האינדקס המקומי.
# # #     """)

# # # # תיבת חיפוש
# # # query = st.text_input("מה אתם מחפשים לשמוע?", placeholder="לדוגמה: 'הדיון על תקציב השיווק' או 'מי דיבר על המנכ''ל?'")

# # # if query:
# # #     with st.spinner("מנתח רלוונטיות בעזרת Gemini..."):
# # #         # הרצת החיפוש ההיברידי
# # #         results = engine.search(query)
    
# # #     if not results:
# # #         st.warning("לא נמצאו תוצאות רלוונטיות. נסו ניסוח אחר.")
    
# # #     for idx, r in enumerate(results):
# # #         # יצירת כרטיסייה לכל תוצאה
# # #         with st.container(border=True):
# # #             col1, col2 = st.columns([0.8, 0.2])
            
# # #             with col1:
# # #                 # הצגת זמן בפורמט MM:SS
# # #                 minutes = int(r['start'] // 60)
# # #                 seconds = int(r['start'] % 60)
# # #                 st.subheader(f"📍 זמן: {minutes:02d}:{seconds:02d}")
                
# # #                 st.markdown(f"**טקסט מזוהה:**")
# # #                 st.write(r['anchor_text'])
                
# # #                 with st.expander("ראה הקשר (Context)"):
# # #                     st.caption(r.get('window_text', 'אין הקשר זמין'))
                
# # #                 st.caption(f"📁 קובץ מקור: {r['file_name']}")
            
# # #             with col2:
# # #                 # הצגת הציון של Gemini
# # #                 st.metric("ציון התאמה", f"{r['score']:.1f}/10")
            
# # #             # הצגת נגן אודיו שמתחיל ב-Timestamp המדויק
# # #             audio_path = os.path.join(LOCAL_DRIVE_AUDIO, r['file_name'])
# # #             if os.path.exists(audio_path):
# # #                 st.audio(audio_path, start_time=int(r['start']))
# # #             else:
# # #                 st.error(f"קובץ האודיו לא נמצא בנתיב: {audio_path}")

# # # # --- טיפול במקרה של תיקייה ריקה ---
# # # if not os.path.exists(LOCAL_DRIVE_INDEX) or not os.listdir(LOCAL_DRIVE_INDEX):
# # #     st.warning(f"תיקיית האינדקס ריקה או לא קיימת בנתיב: {LOCAL_DRIVE_INDEX}. ודא שה-Colab סיים לעבד לפחות קובץ אחד.")