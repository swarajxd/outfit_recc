# FitSense - AI-Powered Outfit Recommendation Platform

## Overview

FitSense is a full-stack mobile application that provides intelligent outfit recommendations powered by AI. It combines visual embeddings, LLM-based intent understanding, and vector similarity search to help users build digital wardrobes and receive style recommendations.

## Tech Stack

### Frontend (Mobile/Web)
| Category | Technology |
|----------|------------|
| Framework | Expo (React Native SDK ~54) |
| Routing | `expo-router` (file-based navigation) |
| State | React hooks, AsyncStorage, Context |
| Auth | **Clerk** - Email + OAuth (Google/Apple) |
| Styling | React Native StyleSheet (dark theme) |
| UI Components | Custom components, `expo-linear-gradient`, `expo-blur` |
| Image | `expo-image`, `expo-image-picker` |

### Backend
| Layer | Technology |
|-------|------------|
| API Gateway | **Node.js + Express** (port 4000) |
| AI Model Server | **Python + FastAPI** (port 8000) |
| Database | **Supabase** (PostgreSQL + pgvector) |
| Storage | **Cloudinary** for image hosting |

### AI/ML Stack
| Component | Technology |
|-----------|------------|
| Embeddings | **CLIP ViT-B/32** (`laion2b_s34b_b79k`) |
| LLM | **Google Gemini** (attribute extraction, query expansion) |
| Detection | **YOLO** (`best.pt`) |
| Segmentation | **DeepLabV3** (fashion segmentation) |
| Vector DB | **pgvector** (HNSW indexing) |
| Image Gen | **Imagen3** (Google Vertex AI - optional) |

## Directory Structure

```
outfit_recc/
├── app/                          # Expo Router - main app code
│   ├── _layout.tsx               # Root layout with Clerk Provider
│   ├── (tabs)/                   # Tab navigation (5 tabs)
│   │   ├── _layout.tsx          # Custom tab bar with center AI button
│   │   ├── home.tsx             # Feed with trendings, AI tools, weekly planner
│   │   ├── explore.tsx          # Explore styles/brands (grid layout)
│   │   ├── ai.tsx               # AI Chat with outfit recommendations
│   │   ├── wardrobe.tsx         # Virtual wardrobe management
│   │   ├── profile.tsx          # User profile with posts/wardrobe
│   │   └── outfitMaker.tsx      # AI outfit generator
│   ├── utils/
│   │   ├── config.ts            # Server URL detection
│   │   ├── cache.ts             # Clerk token cache (SecureStore)
│   │   └── outfitEngine.ts      # Rule-based outfit generation
│   ├── contexts/
│   │   └── AuthContext.tsx      # Auth state management
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client
│   │   └── jwtUtils.ts          # JWT utilities
│   ├── AddOutfit.tsx
│   ├── create-post.tsx          # Social media post creation
│   ├── dailyOutfit.tsx          # Daily outfit details
│   ├── discover.tsx
│   ├── posts.tsx
│   ├── sign-in.tsx              # Clerk sign-in screen
│   └── sign-up.tsx              # Clerk sign-up screen
├── components/                   # Reusable UI components
│   ├── profile/                 # Profile header/tabs/nav
│   ├── ui/                      # PostCard, collapsible, icon-symbol
│   ├── TodayOutfitCard.tsx
│   └── external-link.tsx
├── constants/
│   └── theme.ts                 # Color constants (light/dark)
├── hooks/                        # React hooks
│   ├── use-color-scheme.ts
│   ├── use-color-scheme.web.ts
│   └── use-theme-color.ts
├── server/                       # Node.js backend
│   ├── index.js                 # Main Express server
│   ├── profile.js               # Profile/wardrobe API routes
│   ├── create-post.js           # Post creation helper
│   └── outfit_model/            # Python AI model server
│       ├── api.py               # FastAPI routes
│       ├── pipeline.py          # Main processing pipeline
│       ├── gemini_attributes.py # Gemini integration
│       ├── wardrobe.py          # Wardrobe management
│       ├── detection.py         # YOLO detection
│       ├── segmentation.py      # DeepLabV3 segmentation
│       ├── color_detection.py   # Color analysis
│       ├── attribute_detector.py
│       ├── embedding_service.py # CLIP embeddings
│       └── config.py            # Python config
├── assets/                       # Images, icons, fonts
│   ├── images/                  # App icons, splash, model graphs
│   └── *.jpg                    # Sample images
├── scripts/
│   ├── reset-project.js
│   └── generate_model_graphs.py
├── .env                          # Environment variables
├── app.json                      # Expo configuration
├── package.json
├── README.md
├── WARDROBE_DB_PLAN.md          # Database architecture plan
└── models.md                     # AI model documentation
```

## Core Features

### 1. Digital Wardrobe Management

**Upload Pipeline:**
```
Upload Outfit Photo
    ↓
Segmentation (DeepLabV3) → Object Detection (YOLO)
    ↓
Generate Embeddings (CLIP)
    ↓
Extract Attributes (Gemini)
    ↓
Store in Supabase + pgvector
    ↓
Display in Virtual Wardrobe
```

**Two-Stage Upload:**
- **Stage A:** Quick check (detect + segment + embed, no Gemini)
- **Stage B:** Full processing with attributes + Imagen3 (if requested)

This optimizes for cost and speed by skipping expensive AI steps on duplicates.

### 2. AI Outfit Recommendations

**Recommendation Flow:**
```
User Prompt/Image
    ↓
Gemini → Intent Analysis + Attribute Extraction
    ↓
CLIP → Embedding Generation
    ↓
pgvector → Similar Items Retrieval
    ↓
Rule-based Filtering + Scoring
    ↓
Return Curated Outfit (Top + Bottom + Shoes + Accessory)
```

### 3. Daily Outfit Generation

- Rule-based algorithm with color harmony and category compatibility
- Optional vector-based generation from backend
- Stored in AsyncStorage per day
- Regenerate button available

### 4. Social Feed

- Trending posts display
- Like/unlike system
- Post creation with outfit photos

### 5. Weekly Planner

- Plan outfits for the week
- AI-assisted daily outfit suggestions
- Calendar-based navigation

## Navigation Structure

### Tab Navigation (5 tabs)
| Tab | Route | Purpose |
|-----|-------|---------|
| Feed | `/home` | Trending posts, AI tools, weekly planner, daily outfit |
| Explore | `/explore` | Browse styles, brands, category filtering |
| AI | `/ai` | Chat interface with Sense AI, image upload |
| Wardrobe | `/wardrobe` | Manage digital wardrobe, upload/delete items |
| Profile | `/profile` | User profile, posts grid, wardrobe tabs |

### Tab Bar Layout
Custom implementation with:
- Floating center AI button (distinctive orange gradient)
- Custom icon system (Unicode emojis with SVG fallback)
- Gradient styling and animations

## API Endpoints

### Node.js (`server/index.js`)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/profile/upload-wardrobe` | POST | Upload outfit for segmentation |
| `/api/profile/wardrobe/:userId` | GET | Get user's wardrobe items |
| `/api/profile/posts` | GET | Get user's social posts |
| `/api/create-post` | POST | Create social media post |
| `/api/like-toggle` | POST | Like/unlike a post |
| `/api/for-you` | GET | Feed of trending posts |
| `/api/recommend-outfit` | GET | Vector-based recommendations |
| `/api/recommend-zara` | POST | Zara catalog recommendations |
| `/api/cloudinary-sign` | POST | Get Cloudinary upload signature |
| `/api/health` | GET | Health check |

### Python FastAPI (`server/outfit_model/api.py`)

| Route | Method | Purpose |
|-------|--------|---------|
| `/health` | GET | Check model readiness |
| `/upload-outfit` | POST | Process uploaded outfit image |
| `/job/:jobId` | GET | Get job status |
| `/wardrobe/:user_id` | GET | Get wardrobe JSON |
| `/wardrobe/:user_id/search` | GET | Search wardrobe |
| `/outfits/generate` | POST | Generate outfit from prompt |
| `/recommend-outfit` | GET | Vector recommendations |
| `/recommend-zara` | POST | Zara catalog recommendations |

## Design System

### Color Palette
- **Primary:** `#FF6B00` (Orange)
- **Background:** `#000000` (Black/dark)
- **Surface:** `#111111` (Dark gray)
- **Inactive:** `rgba(255,255,255,0.35)` (Subtle white)

### Typography
- Headings: `800` weight
- Body: `600-700` weight
- Large titles: `42` font size with `-0.5` letter spacing

### Visual Elements
- **Glassmorphism:** `BlurView` + `LinearGradient` overlays
- **Gradient Buttons:** Orange gradient (from `#FF6B00` to `#FF8C42`)
- **Rounded Corners:** `14-28` border radius for modern feel

## Key Architectural Decisions

### 1. Hybrid AI Architecture

The system combines multiple AI models for robust recommendations:

| Component | Role | Fallback Benefit |
|-----------|------|------------------|
| CLIP | Visual similarity | Captures style semantics beyond colors |
| Gemini | Intent understanding | Handles ambiguous prompts |
| pgvector | Fast retrieval | Scales to 10,000+ items |
| Rules | Compatibility | Ensures outfit pieces work together |

### 2. Node + Python Split Architecture

- **Node.js** handles: Auth, Supabase, Cloudinary, static serving, routing
- **Python** handles: ML inference, image processing, embeddings
- Communicates via HTTP on localhost (ports 4000/8000)

### 3. Offline-First Storage

- AsyncStorage for daily outfit cache
- SecureStore for auth tokens
- Local JSON files for vectors in `outfit_model/wardrobe_vectors/`

## Security Considerations

### Authentication
- Clerk handles email/password + OAuth
- Secure token storage via `expo-secure-store`
- Supabase service role key kept server-side only

### Image Upload
- Cloudinary signature-based uploads
- Server validates and signs before client upload
- Folder isolation (`posts/`, `profile_images/`)

### Data Flow
- User images never stored in Supabase directly
- Always uploaded to Cloudinary first
- URLs stored in Supabase for CDN delivery

## Development & Setup

### Prerequisites
- Node.js + npm
- Python 3.8+
- Expo CLI
- Supabase account
- Google Gemini API key
- Cloudinary account

### Environment Variables (`.env`)

```env
# Clerk
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Gemini
GEMINI_API_KEY=your_gemini_key

# Server
PORT=4000
PYTHON_API_URL=http://localhost:8000
```

### Running the Project

```bash
# Install dependencies
npm install

# Start Expo
npx expo start

# Start Node backend (in separate terminal)
cd server && node index.js

# Start Python AI server (in separate terminal)
cd server/outfit_model && python api.py
```

## Summary

FitSense is a sophisticated outfit recommendation platform built with:

1. **Expo/React Native** for cross-platform mobile experience
2. **Clerk** for user authentication
3. **Node.js + Python** for full-stack architecture
4. **Supabase + pgvector** for scalable vector search
5. **CLIP + Gemini + YOLO + DeepLabV3** for AI-powered recommendations

The hybrid approach combining visual embeddings, semantic intent, and rule-based logic delivers robust outfit recommendations. Key differentiators include the two-stage upload pipeline, AI mannequin mode, weekly planner, and custom tab UI with prominent AI access.
