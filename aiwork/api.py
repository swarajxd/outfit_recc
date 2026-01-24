"""FastAPI REST API for FitSense Module 1"""

from fastapi import FastAPI, File, UploadFile, Form, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import shutil
from typing import Optional, Dict
from pipeline import OutfitProcessingPipeline
import config
import uuid
import json
import time

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

# Job storage for async processing
jobs: Dict[str, Dict] = {}

def get_pipeline():
    """Lazy initialization of pipeline"""
    global pipeline
    if pipeline is None:
        pipeline = OutfitProcessingPipeline()
    return pipeline

def process_job_async(job_id: str, image_path: str, user_id: str):
    """Process outfit in background"""
    try:
        pipeline = get_pipeline()
        results = pipeline.process_outfit(
            image_path,
            user_id,
            save_segmented=True
        )
        
        # Get base URL
        import os
        import socket
        host = os.getenv("API_HOST", None)
        if not host:
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.connect(("8.8.8.8", 80))
                host = s.getsockname()[0]
                s.close()
            except:
                host = "192.168.1.102"
        port = os.getenv("API_PORT", "8000")
        base_url = f"http://{host}:{port}"
        
        # Prepare response
        classified_items = []
        for item in results.get("classified_items", []):
            item_path = Path(item["image"])
            if item_path.exists():
                try:
                    relative_path = item_path.relative_to(config.BASE_DIR)
                    image_url = f"{base_url}/static/{relative_path.as_posix()}"
                except ValueError:
                    if "uploads" in str(item_path):
                        image_url = f"{base_url}/static/{item_path.name}"
                    else:
                        image_url = f"{base_url}/static/{item_path.name}"
                
                classified_items.append({
                    "category": item["category"],
                    "image_url": image_url,
                    "attributes": item["attributes"]
                })
        
        detection_viz_path = config.UPLOAD_DIR / f"{user_id}_detections.jpg"
        detection_viz_url = None
        if detection_viz_path.exists():
            detection_viz_url = f"{base_url}/static/uploads/{detection_viz_path.name}"
        
        # Update job with results
        jobs[job_id] = {
            "status": "completed",
            "results": {
                "user_id": results["user_id"],
                "original_image_url": f"{base_url}/static/uploads/{Path(image_path).name}",
                "detection_visualization_url": detection_viz_url,
                "detections": results["detections"],
                "items": classified_items,
                "items_classified": len(classified_items),
                "items_added": len(results["wardrobe_updates"]),
                "wardrobe_summary": results["wardrobe_summary"]
            }
        }
    except Exception as e:
        import traceback
        jobs[job_id] = {
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc()
        }

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
    user_id: str = Form(default="default_user"),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    Upload an outfit image and process it asynchronously
    
    Args:
        file: Outfit image file
        user_id: User identifier
        
    Returns:
        Job ID immediately, process in background
    """
    try:
        # Save uploaded file (must be done synchronously - FastAPI requirement)
        file_ext = Path(file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        upload_path = config.UPLOAD_DIR / unique_filename
        
        # Save file as fast as possible
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Create job ID and return IMMEDIATELY
        job_id = str(uuid.uuid4())
        jobs[job_id] = {"status": "processing"}
        
        # Process in background (non-blocking)
        background_tasks.add_task(process_job_async, job_id, str(upload_path), user_id)
        
        # Return immediately - file is saved, processing starts in background
        return JSONResponse(content={
            "success": True,
            "message": "Upload complete, processing started",
            "job_id": job_id,
            "status": "processing"
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

@app.get("/job/{job_id}")
async def get_job_status(job_id: str):
    """Get job processing status"""
    if job_id not in jobs:
        return JSONResponse(
            status_code=404,
            content={"success": False, "error": "Job not found"}
        )
    
    job = jobs[job_id]
    
    if job["status"] == "completed":
        return JSONResponse(content={
            "success": True,
            "status": "completed",
            "results": job["results"]
        })
    elif job["status"] == "error":
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "status": "error",
                "error": job.get("error", "Unknown error")
            }
        )
    else:
        return JSONResponse(content={
            "success": True,
            "status": "processing",
            "message": "Still processing..."
        })

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
        print(f"⏱️  Timeout: 10 minutes (for AI processing)")
        print(f"{'='*60}\n")
    except:
        print(f"\n🚀 API Server Starting on http://0.0.0.0:8000\n")
        print(f"⏱️  Timeout: 10 minutes (for AI processing)\n")
    
    # Increase ALL timeouts for long-running operations and large file uploads
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        timeout_keep_alive=1800,  # 30 minutes keep-alive
        timeout_graceful_shutdown=30,
        limit_concurrency=1000,  # Allow more concurrent connections
        limit_max_requests=10000  # Allow more requests
    )
