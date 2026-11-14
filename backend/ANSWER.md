# Injected bug

**Symptom:** Searching calls returns each matching file with only one timestamp
(the last match), even when the phrase occurs several times in that recording.

**Cause:** In `services/call.py` → `search_calls_service`, the per-file group
entry is re-created on every result instead of only the first time a file is
seen, so earlier timestamps for the same file are discarded.

**Fix:** Restore the guard before initializing the group:

```python
if f_name not in grouped:
    grouped[f_name] = {"file_name": f_name, "time_stamps": []}
grouped[f_name]["time_stamps"].append(start_time)
```
