import threading, pickle, os, gc, faiss
import numpy as np
from typing import List, Dict, Optional, Tuple
from sentence_transformers import SentenceTransformer
from FlagEmbedding import FlagReranker
from faster_whisper import WhisperModel

class SearchIndexManager:
    def __init__(self, index_path: str = "search_index/faiss_index.pkl"):
        self._stt_lock = threading.Lock()
        self._embedder_lock = threading.Lock()
        self._reranker_lock = threading.Lock()
        
        self._stt_model = None
        self._embedder = None
        self._reranker = None
        
        self.index_path = index_path
        self._faiss_index = None
        self._id_to_chunk = {}
        self._next_id = 0
        self._load_index()

    @property
    def stt_model(self):
        with self._stt_lock:
            if self._stt_model is None:
                self._stt_model = WhisperModel("ivrit-ai/whisper-large-v3-turbo-ct2", device="cpu", compute_type="int8", cpu_threads=8)
            return self._stt_model

    @property
    def embedder(self):
        with self._embedder_lock:
            if self._embedder is None:
                self._embedder = SentenceTransformer("intfloat/multilingual-e5-base")
            return self._embedder

    @property
    def reranker(self):
        with self._reranker_lock:
            if self._reranker is None:
                self._reranker = FlagReranker("BAAI/bge-reranker-v2-m3", use_fp16=False)
            return self._reranker

    def _build_sentences(self, segments):
        words_all = []
        for seg in segments:
            if hasattr(seg, 'words') and seg.words:
                for w in seg.words:
                    words_all.append({"text": w.word.strip(), "start": w.start, "end": w.end})
            else:
                words_all.append({"text": seg.text.strip(), "start": seg.start, "end": seg.end})
        
        sentences = []
        curr_words = []
        terminators = {'.', '!', ',', '?', ';'}

        for i, w in enumerate(words_all):
                curr_words.append(w)
                if (len(curr_words) >= 8 and any(w['text'].endswith(t) for t in terminators)) or i == len(words_all)-1:
                    sentences.append({
                        "text": " ".join([x['text'] for x in curr_words]),
                        # Cast to standard float to avoid np.float64 errors
                        "start": float(curr_words[0]['start']), 
                        "end": float(curr_words[-1]['end'])
                    })
                    curr_words = []
        return sentences

    def add_call_to_index(self, call_id: str, audio_path: str):
        # 1. Transcribe
        print(f"Transcribing {call_id}...")
        segs, info = self.stt_model.transcribe(                     
                    audio_path,
                    beam_size=10,
                    language="he",
                    word_timestamps=True,
                    vad_filter=True,
                    vad_parameters=dict(min_speech_duration_ms=250, speech_pad_ms=400),
                    log_progress=True
                     )
        
        segs = list(segs)


        full_txt = " ".join([s.text.strip() for s in segs])
        
        # 2. Structure Data
        sentences = self._build_sentences(segs)

        chunk_data = {
            "call_id": str(call_id),
            "text": full_txt,
            "start_time": float(segs[0].start) if segs else 0.0,
            "end_time": float(segs[-1].end) if segs else 0.0,
            "sentences": sentences
        }

        # 3. Embed & FAISS
        emb = self.embedder.encode([f"passage: {full_txt}"], convert_to_numpy=True)
        faiss.normalize_L2(emb)
        
        if self._faiss_index is None:
            self._faiss_index = faiss.IndexFlatIP(emb.shape[1])
            
        self._faiss_index.add(emb.astype('float32'))
        self._id_to_chunk[self._next_id] = chunk_data
        self._next_id += 1
        self._save_index()
        return full_txt, [chunk_data]

    def search_precise(self, query: str, k: int = 5):
            if not self._faiss_index: 
                return []
            
            # Step 1: FAISS KNN (Top 3 Segments/Chunks)
            # We prefix with 'query: ' for the e5 model as required
            q_emb = self.embedder.encode([f"query: {query}"], convert_to_numpy=True)
            faiss.normalize_L2(q_emb)
            _, indices = self._faiss_index.search(q_emb.astype('float32'), 3)
            
            # Step 2: Gather candidate sentences from the top 3 segments
            candidates = []
            for idx in indices[0]:
                if idx == -1: 
                    continue
                chunk = self._id_to_chunk[idx]
                # Every sentence inside the Whisper segment is considered a candidate
                for sent in chunk['sentences']:
                    candidates.append({**sent, "call_id": chunk['call_id']})
            
            if not candidates: 
                return []
            
            # Step 3: Rerank all gathered sentences using the Reranker model
            pairs = [[query, c['text']] for c in candidates]
            scores = self.reranker.compute_score(pairs)
            
            # Convert scores to native float to avoid serialization errors
            for i, score in enumerate(scores): 
                candidates[i]['score'] = float(score)
            
            print(f"Reranked {len(candidates)} candidates.")
            print("Top candidates after reranking:")
            print(sorted(candidates, key=lambda x: x['score'], reverse=True)[:k])
            
            # Sort by best score and return the top K
            candidates.sort(key=lambda x: x['score'], reverse=True)
            return candidates[:k] 

    def _save_index(self):
        os.makedirs(os.path.dirname(self.index_path), exist_ok=True)
        # 1. Save the FAISS index using native methods
        if self._faiss_index is not None:
            faiss.write_index(self._faiss_index, self.index_path + ".bin")
        
        # 2. Save the metadata (mapping and ID counter) using pickle
        metadata_path = self.index_path + ".meta"
        with open(metadata_path, "wb") as f:
            pickle.dump({
                "map": self._id_to_chunk, 
                "next": self._next_id
            }, f)

    def _load_index(self):
        index_bin = self.index_path + ".bin"
        metadata_path = self.index_path + ".meta"
        
        if os.path.exists(index_bin) and os.path.exists(metadata_path):
            # 1. Load FAISS index natively
            self._faiss_index = faiss.read_index(index_bin)
            
            # 2. Load metadata
            with open(metadata_path, "rb") as f:
                data = pickle.load(f)
                self._id_to_chunk = data.get("map", {})
                self._next_id = data.get("next", 0)
            
            # Debugging: Verify it's not empty
            print(f"Loaded index with {self._faiss_index.ntotal} vectors.")
