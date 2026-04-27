# FitSense — Outfit Recommendation System

A hybrid multimodal AI system for intelligent outfit recommendations, combining **visual embeddings**, **LLM-based intent understanding**, and **vector similarity search**.

## Overview

This project is a full-stack app:

- **Frontend**: Expo / React Native (`app/`)
- **Node backend**: Express API gateway (`server/index.js`)
  - Auto-starts the Python model server
  - Proxies AI endpoints to Python
  - Reads wardrobe items from Supabase
- **Python backend**: FastAPI outfit model (`server/outfit_model/api.py`)
  - Upload → detect → segment → embed → attributes → store vectors (Supabase pgvector)
  - Recommend from prompt and/or image via vector retrieval + re-ranking

## Model Stack (What’s Used)

The pipeline is not a classic classifier-only ML system; it’s a hybrid:

- **CLIP ViT-B/32 (`laion2b_s34b_b79k`)**
  - **Purpose**: Converts clothing images (and text prompts) into dense embeddings.
  - **Role**: Powers visual similarity search and vector-based retrieval.
- **Gemini (attribute extraction + query expansion)**
  - **Purpose**: Extracts semantic clothing attributes (color, fit, material, occasion, etc.) and expands user intent.
  - **Role**: Produces structured intent used to filter/rank vector candidates.
- **Supabase Postgres + pgvector (HNSW)**
  - **Purpose**: Efficient nearest-neighbor search in the database.
  - **Role**: Retrieves top-K relevant items/outfits by cosine distance.
- **Rule-based / heuristic re-ranker**
  - **Purpose**: Combines vector similarity with constraints (category buckets + compatibility).
  - **Role**: Final outfit assembly (top/bottom/shoes/outerwear/accessory).

## Best/Final Approach (Hybrid Multimodal Retrieval + LLM Intent Fusion)

**Inputs**
- User prompt (text)
- Optional user image
- Stored embeddings: `visual_embedding`, `text_embedding`, `combined_embedding`
- Item metadata/attributes: category, color, occasion, etc.

**Workflow**
1. **Intent understanding**
   - Gemini expands prompt into structured attributes.
   - If image attribute extraction is weak, the system falls back to **nearest-vector-neighbor inference**.
2. **Embedding generation**
   - CLIP encodes image/prompt into embeddings.
3. **Candidate retrieval**
   - pgvector cosine similarity fetches top-K items/outfits.
4. **Constraint filtering**
   - Enforces category bucket logic and optional attribute filters.
5. **Re-ranking + composition**
   - Final weighted scoring and cross-category coherence.

**Why it performs better**
- Robust to partial failure (prompt-only or image-only still works well).
- Captures both semantics (LLM) and visual similarity (CLIP).
- Scales to large catalogs via HNSW on pgvector.

## Performance Comparison (Simulated)

> No formal benchmark sheet is included in this repo yet, so values below are **simulated for demonstration**.

| Model | Accuracy | Precision | Recall | F1 Score |
|---|---:|---:|---:|---:|
| Rule-Based Baseline | 0.71 | 0.69 | 0.73 | 0.71 |
| CLIP Retrieval | 0.82 | 0.81 | 0.83 | 0.82 |
| LLM Intent Only (Gemini) | 0.79 | 0.80 | 0.77 | 0.78 |
| **Hybrid Final** | **0.89** | **0.90** | **0.88** | **0.89** |

Graph generated at: `assets/model_performance_comparison.png`

## Generate the Performance Graph

This repo includes a script that saves the chart as a PNG (headless / CI-friendly):

```bash
.venv/bin/python scripts/generate_model_graphs.py
```

Output:
- `assets/model_performance_comparison.png`

## Running the App

### 1) Install JS deps

```bash
npm install
```

### 2) Configure environment variables

This repo loads `.env` from the project root.

**Required (Node/server side)**
- `PORT=4000` (default)
- `OUTFIT_PORT=8000` (default)
- `SUPABASE_URL=...`
- `SUPABASE_SERVICE_ROLE_KEY=...` (server-side only; never expose to client)
- `CLOUDINARY_CLOUD_NAME=...`
- `CLOUDINARY_API_KEY=...`
- `CLOUDINARY_API_SECRET=...`

**Required (Python/vector DB)**
- `SUPABASE_DB_URL=...` (Postgres connection string used by `psycopg2`)
- `GOOGLE_API_KEY=...` (Gemini)

Optional:
- `PYTHON_PATH=...` (override python used by Node to start FastAPI)
- `ENABLE_MANNEQUIN_ON_UPLOAD=false` (recommended for faster uploads)

### 3) Start backend (Node + auto-start Python)

```bash
npm run server
```

Dev watch:

```bash
npm run server:watch
```

Node runs on `http://0.0.0.0:4000` by default.

### 4) Start frontend (Expo)

```bash
npm run start
```

**Android emulator note**
- If you use a local Node backend, set the app API base to `http://10.0.2.2:4000` (Android emulator loopback to host).

## Key API Endpoints

Node (Express):
- `POST /api/profile/upload-wardrobe` → forwards to Python `/upload-outfit`
- `GET /api/profile/wardrobe/:userId` → reads wardrobe from Supabase `wardrobe_items`
- `POST /api/recommend-zara` → forwards to Python `/recommend-zara`
- `GET /api/recommend-outfit` → forwards to Python `/recommend-outfit`

Python (FastAPI):
- Runs from `server/outfit_model/api.py` (started automatically by Node)
- Stores vectors via `server/outfit_model/store_vectors_supabase.py`

## Database (Supabase)

The vector store creates/uses:
- `wardrobe_items` (per clothing item)
- `outfit_vectors` (per user, outfit-level vectors)

Indexes:
- HNSW indexes for fast cosine similarity search.

## Scripts

- `scripts/generate_model_graphs.py`: generates `assets/model_performance_comparison.png`
- `server/outfit_model/store_vectors_supabase.py`: Cloudinary upload + Supabase pgvector upsert + test queries

## Insights / Trade-offs

- **Speed vs accuracy**: Hybrid is slower than single-model baselines but improves recommendation quality.
- **Complexity vs interpretability**: More components, but fallback paths improve production reliability.

## Suggested Next Improvements

- Add a real evaluation dataset (prompt + image + human-judged relevance).
- Train a learn-to-rank model (LightGBM/XGBoost) over retrieval features.
- Improve confidence calibration for image color/material.
- Add user feedback signals (click/save/purchase) for personalization.
