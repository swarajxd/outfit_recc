# 👗 Outfit Recommendation Pipeline

A hybrid multimodal AI system for intelligent outfit recommendations, combining visual embeddings, LLM-based intent understanding, and vector similarity search.

---

## 🧠 System Overview

The pipeline fuses multiple AI components to deliver high-quality, context-aware outfit recommendations from either a text prompt, an image, or both.

```
User Input (text / image)
        ↓
  Intent Understanding (Gemini)
        ↓
  Embedding Generation (CLIP ViT-B/32)
        ↓
  Vector Retrieval (pgvector / Supabase)
        ↓
  Constraint Filtering (category, occasion, color)
        ↓
  Re-ranking (semantic + visual + compatibility)
        ↓
  Final Outfit Composition
```

---

## 🔧 Models & Components

### 1. CLIP ViT-B/32 (`laion2b_s34b_b79k`)
- Converts clothing images and text into dense embeddings
- Powers visual similarity search and vector-based retrieval from wardrobe items and the Zara catalog

### 2. Gemini (Attribute Extraction + Query Expansion)
- Extracts semantic clothing attributes: color, fit, material, occasion, etc.
- Expands ambiguous user intent into structured, filterable signals
- Falls back to nearest-vector-neighbor inference when image attributes are weak

### 3. pgvector (Cosine Similarity Search)
- Nearest-neighbor retrieval over `visual_embedding`, `text_embedding`, and `combined_embedding` columns in Supabase/Postgres
- Retrieves top-K relevant items/outfits efficiently using HNSW indexing

### 4. Rule-Based Re-ranker
- Combines vector similarity with category constraints and style compatibility
- Handles final outfit assembly across top/bottom/shoes/outerwear/accessory slots

---

## 📊 Model Performance Comparison

> **Note:** Metrics below are simulated for demonstration purposes.

| Model | Accuracy | Precision | Recall | F1 Score |
|---|---|---|---|---|
| Rule-Based Baseline | 0.71 | 0.69 | 0.73 | 0.71 |
| CLIP Retrieval | 0.82 | 0.81 | 0.83 | 0.82 |
| LLM Intent Only (Gemini) | 0.79 | 0.80 | 0.77 | 0.78 |
| **Hybrid Final (LLM + CLIP + pgvector + Rerank)** | **0.89** | **0.90** | **0.88** | **0.89** |

### Generate the comparison chart

```python
import matplotlib.pyplot as plt
import numpy as np

models   = ["Rule-Based", "CLIP Retrieval", "LLM Intent Only", "Hybrid Final"]
accuracy  = [0.71, 0.82, 0.79, 0.89]
precision = [0.69, 0.81, 0.80, 0.90]
recall    = [0.73, 0.83, 0.77, 0.88]
f1        = [0.71, 0.82, 0.78, 0.89]

x, w = np.arange(len(models)), 0.2
plt.figure(figsize=(11, 6))
plt.bar(x - 1.5*w, accuracy,  width=w, label="Accuracy")
plt.bar(x - 0.5*w, precision, width=w, label="Precision")
plt.bar(x + 0.5*w, recall,    width=w, label="Recall")
plt.bar(x + 1.5*w, f1,        width=w, label="F1 Score")
plt.xticks(x, models, rotation=10)
plt.ylim(0.6, 1.0)
plt.ylabel("Score")
plt.title("Model Performance Comparison (Simulated)")
plt.legend()
plt.tight_layout()
plt.show()
```

---

## ✅ Why the Hybrid Approach Wins

| Strength | Component |
|---|---|
| Visual similarity | CLIP ViT-B/32 |
| Semantic intent understanding | Gemini |
| Fast large-scale retrieval | pgvector + HNSW |
| Cross-category outfit coherence | Rule-based re-ranker |

**Robustness:** Fallback from vector neighbors ensures recommendations remain solid even when one signal (e.g., image attribute extraction) is weak.

---

## ⚖️ Trade-offs

| Factor | Detail |
|---|---|
| Speed vs. Accuracy | Hybrid is slower than single-model baselines but delivers significantly better quality |
| Complexity vs. Interpretability | More components means harder debugging, but fallback paths improve production reliability |

---

## 🚀 Recommended Improvements

- **Offline evaluation set** — Build a benchmark dataset of (prompt + image + human-judged outfit relevance)
- **Learn-to-rank head** — Add LightGBM/XGBoost on top of retrieval features for better ranking
- **Image-attribute calibration** — Improve confidence scoring for color and material detection
- **User feedback loop** — Incorporate click/save/purchase signals for personalization and continuous re-ranking

---

## 🗂️ Architecture Summary

```
Inputs
├── User text prompt
├── Optional user image
├── Catalog embeddings (visual / text / combined)
└── Item metadata (category, color, occasion, ...)

Processing
├── Gemini → structured intent attributes
├── CLIP → image/text embedding
├── pgvector → top-K candidate retrieval
├── Category + attribute filtering
└── Weighted re-ranking (semantic + visual + compatibility)

Output
└── Final outfit with cross-category coherence
```

---

## 📦 Tech Stack

- **Embeddings:** CLIP ViT-B/32 via `open_clip` (`laion2b_s34b_b79k`)
- **LLM:** Google Gemini (attribute extraction & query expansion)
- **Vector DB:** Supabase + pgvector (HNSW indexing)
- **Visualization:** Matplotlib, NumPy