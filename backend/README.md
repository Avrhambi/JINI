# JINI — Backend API

FastAPI service for authentication, user management, and call management. Part of the
[JINI final project](../README.md) — B.Sc. Computer Science, Bar-Ilan University.

Sits between the [mobile app](../frontend/README.md) and the
[search engine](../search_engine/README.md): it owns the users/calls database and
delegates transcription and search to the search service.

## Features

- Email/password + Google OAuth auth, JWT access/refresh tokens
- Call upload, rename, delete, favorites, metadata (caller, number, type, date)
- Transcription and semantic search delegated to the search service
- GZip compression, ORJSON responses, async I/O, MongoDB connection pooling
- CORS enabled for the mobile client

## Tech stack

| Technology | Purpose |
|---|---|
| FastAPI + Uvicorn | Web framework / ASGI server |
| MongoDB (pymongo) | User and call storage |
| PyJWT | Token generation/verification |
| Passlib + bcrypt | Password hashing |
| Google Auth | Google OAuth 2.0 |
| HTTPX | Async calls to the search service |
| Pydantic | Validation / settings |

## Project structure

```
backend/
├── server.py            # FastAPI app, middleware, router wiring
├── config/
│   ├── db.py            # MongoDB connection pool
│   └── requirements.txt
├── routes/              # auth.py, user.py, call.py  (endpoint definitions)
├── controllers/         # business logic per domain
├── models/              # Pydantic schemas
├── services/            # search-service integration, user ops
├── middleware/auth.py   # JWT middleware
├── utils/               # auth helpers
├── manage.bat           # Windows venv/run helper
└── tests/
```

## Setup (Windows)

Requires **Python 3.10** and a running **MongoDB**, plus the search service on
`http://localhost:5000`.

```powershell
# add a `jini` helper to your PowerShell profile (see manage.bat), then:
jini init     # create venv, install config/requirements.txt
jini run      # start Uvicorn on http://localhost:8000
```

Manual alternative:

```bash
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

Copy `.env.example` to `.env` and fill in the values.

### Environment variables

| Variable | Description | Default |
|---|---|---|
| `MONGODB_URL` | MongoDB connection string | `mongodb://localhost:27017` |
| `DATABASE_NAME` | Database name | `jini` |
| `SEARCH_SERVICE_URL` | Search service base URL | `http://localhost:5000` |
| `SECRET_KEY` | JWT secret | — |
| `ALGORITHM` | JWT algorithm | `HS256` |

## API

Interactive docs at `http://localhost:8000/docs` (Swagger) and `/redoc`.

**Auth** — `POST /auth/signup`, `POST /auth/login`, `POST /auth/login/google`, `PUT /auth/refresh`

**Calls** — `POST /calls/upload`, `POST /calls/search`, `PUT /calls/rename`,
`DELETE /calls/delete`, `POST|DELETE /calls/favorites/{add,remove}`, `GET /calls/favorites`

**Users** — `GET|PUT /users/profile`, `DELETE /users/account`

Protected routes expect `Authorization: Bearer <token>`.

## Data model

**users**: `email`, `password_hash`, `name`, `created_at`, `updated_at`

**calls**: `user_id`, `original_name`, `visible_name`, `number`, `type`, `caller`,
`date`, `file_path`, `transcript`, `created_at`

## Tests

```bash
python -m pytest -v tests/
```

Uses `mongomock` for an in-memory database; fixtures in `tests/conftest.py` provide a
mocked DB and a real test user for JWT flows.

## License

Academic project.
