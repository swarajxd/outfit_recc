"""Configuration settings for FitSense Module 1"""

import os
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
WARDROBE_DIR = BASE_DIR / "wardrobe"
MODELS_DIR = BASE_DIR / "models"

# Create directories
UPLOAD_DIR.mkdir(exist_ok=True)
WARDROBE_DIR.mkdir(exist_ok=True)
MODELS_DIR.mkdir(exist_ok=True)

# YOLO Configuration
# Try direct path first, then fallback to nested path
if (BASE_DIR / "best.pt").exists():
    YOLO_MODEL = str(BASE_DIR / "best.pt")
else:
    YOLO_MODEL = str(BASE_DIR / "runs" / "detect" / "runs" / "detect" / "fashion_detection_90pct" / "weights" / "best.pt")
YOLO_CONFIDENCE = 0.15
YOLO_IOU = 0.45

# Clothing classes to detect
CLOTHING_CLASSES = {
    "tshirt": ["tshirt", "shirt", "top"],
    "jeans": ["jeans", "pants", "trousers"],
    "shoes": ["shoes", "sneakers", "boots"],
    "watch": ["watch"],
    "cap": ["cap", "hat"],
    "bag": ["bag", "backpack", "handbag"]
}

# SAM Configuration
SAM_MODEL = "sam_vit_h.pth"  # or sam_vit_l.pth, sam_vit_b.pth
SAM_CHECKPOINT_URL = "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth"

# Classification Configuration
CLASSIFICATION_MODEL = "efficientnet_b0"
NUM_COLORS = 10  # Common colors: black, white, blue, red, green, etc.
NUM_PATTERNS = 5  # solid, striped, printed, etc.

# Wardrobe Schema
WARDROBE_CATEGORIES = ["tshirts", "jeans", "shoes", "watches", "caps", "bags"]
