"""FastAPI REST API for FitSense Module 1"""

from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import shutil
from typing import Optional
from pipeline import OutfitProcessingPipeline
import config

app = FastAPI(
    title="FitSense Module 1 API",
    description="Digital Wardrobe from Outfit Image",
    version="1.0.0"
)

# Add CORS middleware to allow React Native app to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (for development)
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

# Initialize pipeline (lazy loading)
pipeline: Optional[OutfitProcessingPipeline] = None

def get_pipeline():
    """Lazy initialization of pipeline"""
    global pipeline
    if pipeline is None:
        pipeline = OutfitProcessingPipeline()
    return pipeline

@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "message": "FitSense Module 1 API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "POST /upload-outfit": "Upload outfit image and process",
            "GET /wardrobe/{user_id}": "Get user's wardrobe",
            "GET /wardrobe/{user_id}/summary": "Get wardrobe summary",
            "GET /health": "Health check endpoint"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint for connection testing"""
    return {
        "status": "healthy",
        "message": "API is running"
    }

@app.post("/upload-outfit")
async def upload_outfit(
    file: UploadFile = File(...),
    user_id: str = Form(default="default_user")
):
    """
    Upload an outfit image and process it through the pipeline
    
    Args:
        file: Outfit image file
        user_id: User identifier
        
    Returns:
        Processing results with image URLs
    """
    try:
        # Save uploaded file
        import uuid
        file_ext = Path(file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        upload_path = config.UPLOAD_DIR / unique_filename
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Process through pipeline
        pipeline = get_pipeline()
        results = pipeline.process_outfit(
            str(upload_path),
            user_id,
            save_segmented=True
        )
        
        # Prepare response with image URLs
        import os
        import socket
        # Get local IP address for mobile device access
        host = os.getenv("API_HOST", None)
        if not host:
            try:
                # Connect to external address to get local IP
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.connect(("8.8.8.8", 80))
                host = s.getsockname()[0]
                s.close()
            except:
                host = "192.168.1.105"  # Fallback to detected IP
        port = os.getenv("API_PORT", "8000")
        base_url = f"http://{host}:{port}"
        
        classified_items = []
        
        for item in results.get("classified_items", []):
            item_path = Path(item["image"])
            if item_path.exists():
                # Create URL for segmented item
                # Path relative to BASE_DIR
                try:
                    relative_path = item_path.relative_to(config.BASE_DIR)
                    image_url = f"{base_url}/static/{relative_path.as_posix()}"
                except ValueError:
                    # If path is not relative, use absolute path from uploads
                    if "uploads" in str(item_path):
                        image_url = f"{base_url}/static/{item_path.name}"
                    else:
                        image_url = f"{base_url}/static/{item_path.name}"
                
                classified_items.append({
                    "category": item["category"],
                    "image_url": image_url,
                    "attributes": item["attributes"]
                })
        
        # Get detection visualization URL
        detection_viz_path = config.UPLOAD_DIR / f"{user_id}_detections.jpg"
        detection_viz_url = None
        if detection_viz_path.exists():
            detection_viz_url = f"{base_url}/static/uploads/{detection_viz_path.name}"
        
        return JSONResponse(content={
            "success": True,
            "message": "Outfit processed successfully",
            "results": {
                "user_id": results["user_id"],
                "original_image_url": f"{base_url}/static/uploads/{unique_filename}",
                "detection_visualization_url": detection_viz_url,
                "detections": results["detections"],
                "items": classified_items,
                "items_classified": len(classified_items),
                "items_added": len(results["wardrobe_updates"]),
                "wardrobe_summary": results["wardrobe_summary"]
            }
        })
    
    except Exception as e:
        import traceback
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e),
                "traceback": traceback.format_exc()
            }
        )

@app.get("/wardrobe/{user_id}")
async def get_wardrobe(user_id: str):
    """
    Get user's complete wardrobe
    
    Args:
        user_id: User identifier
        
    Returns:
        User's wardrobe data
    """
    try:
        pipeline = get_pipeline()
        wardrobe = pipeline.wardrobe.get_user_wardrobe(user_id)
        return JSONResponse(content={
            "success": True,
            "wardrobe": wardrobe
        })
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e)
            }
        )

@app.get("/wardrobe/{user_id}/summary")
async def get_wardrobe_summary(user_id: str):
    """
    Get wardrobe summary statistics
    
    Args:
        user_id: User identifier
        
    Returns:
        Wardrobe summary
    """
    try:
        pipeline = get_pipeline()
        summary = pipeline.wardrobe.get_wardrobe_summary(user_id)
        return JSONResponse(content={
            "success": True,
            "summary": summary
        })
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e)
            }
        )

@app.get("/wardrobe/{user_id}/search")
async def search_wardrobe(
    user_id: str,
    color: Optional[str] = None,
    pattern: Optional[str] = None,
    category: Optional[str] = None
):
    """
    Search wardrobe items by filters
    
    Args:
        user_id: User identifier
        color: Filter by color
        pattern: Filter by pattern
        category: Filter by category
        
    Returns:
        Matching items
    """
    try:
        pipeline = get_pipeline()
        
        filters = {}
        if color:
            filters["color"] = color
        if pattern:
            filters["pattern"] = pattern
        
        items = pipeline.wardrobe.search_items(user_id, filters)
        
        # Filter by category if specified
        if category:
            items = [item for item in items if category in item.get("image", "")]
        
        return JSONResponse(content={
            "success": True,
            "count": len(items),
            "items": items
        })
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e)
            }
        )

# Mount static files for serving images
app.mount("/static", StaticFiles(directory=str(config.BASE_DIR)), name="static")

if __name__ == "__main__":
    import uvicorn
    import socket
    # Get local IP for display
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        print(f"\n{'='*60}")
        print(f"🚀 API Server Starting...")
        print(f"📱 Mobile app should connect to: http://{local_ip}:8000")
        print(f"{'='*60}\n")
    except:
        print(f"\n🚀 API Server Starting on http://0.0.0.0:8000\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
