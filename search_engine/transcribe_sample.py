import os
import sys
import time
from faster_whisper import WhisperModel

# standalone on purpose: importing server.py would connect to MongoDB and load the embedder
MODEL_NAME = "ivrit-ai/whisper-large-v3-turbo-ct2"
DEFAULT_AUDIO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tests", "recordings", "user_a_private.wav")


def main():
    audio_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_AUDIO
    if not os.path.isfile(audio_path):
        print(f"❌ Audio file not found: {audio_path}", file=sys.stderr)
        sys.exit(1)

    print(f"⏳ Loading Whisper model {MODEL_NAME}...")
    model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")

    print(f"🎙️ Transcribing {audio_path}...")
    start = time.time()
    segments, info = model.transcribe(audio_path, language="he")
    # segments is a generator: the actual transcription happens while iterating
    for seg in segments:
        print(f"[{seg.start:7.2f} -> {seg.end:7.2f}] {seg.text.strip()}")

    print(f"✅ Done: {info.duration:.1f}s of audio in {time.time() - start:.1f}s")


if __name__ == "__main__":
    main()
