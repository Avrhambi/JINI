# Exercise 2 — Debugging log and comparison with ANSWER.md

Setup: the bug was planted by one AI session (started from `backend/`, commit
"agent change"). Debugging was done with a second, fresh AI session acting as a
mentor (asks questions, keeps the log, gives no answers). I ran the backend +
MongoDB locally and exercised it through the FastAPI `/docs` page; the search
engine service was not running.

## Mentor log

| # | What I saw | Question | Hypothesis | Change tested | Result |
|---|---|---|---|---|---|
| 1 | Backend log: signup and login 200. `/calls/upload` 401, then 500 "Upload Failed: All connection attempts failed". rename, favorites add/remove and delete 404 "No record for user … with name string". `/calls/search` 200 with "Error during search: All connection attempts failed". | Which failure are you chasing, and what did you expect? | 4xx responses are expected (bad input or a known backend issue). The upload 500 happens because the search engine isn't running. | None | Non-2xx responses all explained. Ruled out of scope. |
| 2 | Some 200s are wrong: the user has no audios, so audio retrieval and editing endpoints shouldn't succeed. | Which endpoints, and what body came back? | — | None | Narrowed to `GET /calls/favorites` and `POST /calls/search`. |
| 3 | `GET /calls/favorites` returns 200 with `[]`. Expected `[]` with a 4xx ("no calls found"). | What's your hypothesis? | There's a bug in the DB lookup. | None | Superseded by rows 4 and 5. |
| 4 | `search_calls_service` in `call.py` ends in `except Exception` → `print(...)` → `return []`. Log: "Error during search: All connection attempts failed" followed by `POST /calls/search` 200. | Does favorites go through this function too? | When the search engine fails, the exception is swallowed and `[]` comes back with 200. | Code read plus log match | Confirmed for `/calls/search`. Favorites doesn't use this function. |
| 5 | `get_user_favorites_service` in `call.py` initializes `favorite_files = []`, loops over `user.favorites`, and returns the list. Nothing in it signals "no calls found". | What's your hypothesis for favorites? | The user has no favorites, so the loop never runs and the initial `[]` is returned with 200. | None | Untested. Supported by code read only. |

**Mentor's process note:** The search engine wasn't running at any point in
this session, and the test user had no calls uploaded. Every search request
failed before it reached the search results handling, so nothing observable
from the backend could have shown the bug.

## Comparison with ANSWER.md

**Did I find the bug?** No.

**What the bug was (from ANSWER.md):** in `backend/services/call.py` →
`search_calls_service`, the guard `if f_name not in grouped:` was removed, so
the per-call entry is re-created for every search result. When the search
engine returns several relevant segments from the same call, only the last
timestamp is kept.

**What would have shortened the path:**
1. **Run the full path the feature uses.** I ran the backend without the search
   engine and with no uploaded calls, so search failed before reaching the
   buggy code. With the search engine up and one call uploaded where a phrase
   repeats, the missing timestamps would have shown on the first search.
2. **Follow the data path, not only the error path.** In row 4 I was already in
   the right function but only examined its `except` branch; the grouping loop
   just above it was the bug.
3. **Check what changed first.** `git log --stat -1` would have pointed to
   `services/call.py` immediately and focused the session on search.
