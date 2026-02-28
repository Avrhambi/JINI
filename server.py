# local/server.py
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from faster_whisper import WhisperModel
from sentence_transformers import SentenceTransformer
from storage import Storage
from search_engine import SearchEngine
from dotenv import load_dotenv
from transformers import logging as transformers_logging
import traceback

load_dotenv()
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})


# constants
MIN_WORDS, MIN_DURATION, MAX_WORDS = 6, 3.5, 22

# models initialization
print("⏳ Loading local models and DB...")
storage = Storage(mongo_uri="mongodb://localhost:27017")

transformers_logging.set_verbosity_error() # suppress transformers warnings about quantized models
embedder = SentenceTransformer("intfloat/multilingual-e5-small")

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

whisper_model = WhisperModel("ivrit-ai/whisper-large-v3-turbo-ct2", device="cpu", compute_type="int8")



def transcribe(audio_path: str):
    """Trancribe audio and adds word-level timestamps"""
    segments, _ = whisper_model.transcribe(audio_path, word_timestamps=True)
    words = []
    for seg in segments:
        for w in seg.words:
            words.append({"word": w.word.strip(), "start": w.start, "end": w.end})
    return words


def reconstruct_sentences(words):
    """Create sentences from transcribed words using heuristics"""
    sentences = []
    buffer = []
    start_time = None

    # helper function to flush buffer into sentences
    def flush(end_time):
        nonlocal buffer, start_time # access outer scope variables
        if not buffer: return 
        text = " ".join(w["word"] for w in buffer) # reconstruct text
        sentences.append({"text": text, "start": start_time, "end": end_time}) # save sentence
        buffer = []
        start_time = None 

    for i, w in enumerate(words):
        if not buffer: start_time = w["start"] 
        buffer.append(w) 

        duration = w["end"] - start_time
        word_count = len(buffer) 

        
        ends_with_bad_word = w["word"] in ["ו", "אז", "אבל", "כי", "ש", "אם", "או", "ל"]
        ends_with_punctuation = any(char in w["word"] for char in [".", "?", "!", ";"])

        if word_count >= MAX_WORDS: 
            flush(w["end"]) # flush if sentence too long
        elif (word_count >= MIN_WORDS and duration >= MIN_DURATION and ends_with_punctuation and (not ends_with_bad_word)):
            flush(w["end"]) # flush on when sentence ends properly

    if buffer: flush(buffer[-1]["end"]) # flush remaining buffer
    return sentences


def build_blocks(sentences, block_size=6, step=2):
    """Build text blocks with overlap from sentences"""
    blocks = []
    for i in range(0, len(sentences), step):
        block_sentences = sentences[i : i + block_size]
        if len(block_sentences) < 2 and i > 0:
            break

        block_text = " ".join([s['text'] for s in block_sentences])
        blocks.append({
            "window_text": block_text,
            "sentences": block_sentences,
            "start": block_sentences[0]['start'],
            "end": block_sentences[-1]['end']
        })
    return blocks


# ==========================================
# API Routes
# ==========================================

@app.route('/upload', methods=['POST'])
def upload_and_process():
    """streaming upload and processing endpoint"""
    user_id = request.form.get('user_id')
    file = request.files.get('file')
    print(f"Received upload request from user_id: {user_id}")
    
    if not user_id or not file:
        return jsonify({"error": "Missing data"}), 400

    # saving temp file for processing
    temp_path = f"temp_{file.filename}"
    file.save(temp_path)
    
    try:
        print("⏳ Processing audio...")
        # performing transcription
        words = transcribe(temp_path)
        sentences = reconstruct_sentences(words)
        full_transcript = " ".join([s['text'] for s in sentences])
        blocks = build_blocks(sentences)

        # embedding
        texts = [f"passage: {b['window_text']}" for b in blocks]
        embeddings = embedder.encode(texts, normalize_embeddings=True, batch_size=32)

        # storing in DB
        storage.save_windows(file_name=file.filename, blocks=blocks, embeddings=embeddings.tolist(), full_transcript=full_transcript, user_id=user_id)
        
        # cleanup temp file
        os.remove(temp_path)
        return jsonify({"status": "success", "transcript": full_transcript}), 200

    except Exception as e:
        traceback.print_exc() # print full traceback for debugging
        if os.path.exists(temp_path): os.remove(temp_path)
        return jsonify({"error": str(e)}), 500
    

@app.route('/search', methods=['GET'])
def search():
    """search audios by query"""
    query = request.args.get('q')
    user_id = request.args.get('user_id')
    
    if not query or not user_id:
        return jsonify({"error": "Missing query or user_id"}), 400
        
    results = search_engine.search(query, user_id=user_id)
    return jsonify({"results": results})

@app.route("/delete", methods=['DELETE'])
def delete():
    """Endpoint to delete audio metadata and its vector embeddings"""
    user_id = request.args.get('user_id')
    file_name = request.args.get('original_name') 
    
    if not user_id or not file_name:
        return jsonify({"error": "Missing user_id or original_name"}), 400
        
    try:
        storage.delete_record(user_id, file_name)
        return jsonify({"message": f"File {file_name} deleted successfully"}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/', methods=['GET'])
def root():
    return {"message": "Search engine is running"}


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
