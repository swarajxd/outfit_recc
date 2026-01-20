"""Main Pipeline: Orchestrates Detection -> Segmentation -> Classification -> Storage"""

from pathlib import Path
from typing import Dict, List
import shutil

from detection import ClothingDetector
from segmentation import ClothingSegmenter
from classification import ClothingClassifier
from wardrobe import DigitalWardrobe
import config

class OutfitProcessingPipeline:
    """Complete pipeline for processing outfit images"""
    
    def __init__(self):
        """Initialize all components"""
        print("Initializing pipeline components...")
        
        self.detector = ClothingDetector()
        print("✓ Detection model loaded")
        
        try:
            self.segmenter = ClothingSegmenter()
            print("✓ Segmentation model loaded")
        except FileNotFoundError as e:
            print(f"⚠ Warning: {e}")
            print("⚠ Segmentation will be skipped. Please download SAM model.")
            self.segmenter = None
        
        self.classifier = ClothingClassifier()
        print("✓ Classification model loaded")
        
        self.wardrobe = DigitalWardrobe()
        print("✓ Wardrobe storage initialized")
        
        print("\n🎉 Pipeline ready!\n")
    
    def process_outfit(self, image_path: str, user_id: str, 
                      save_segmented: bool = True) -> Dict:
        """
        Process a complete outfit image through the full pipeline
        
        Args:
            image_path: Path to outfit image
            user_id: User identifier
            save_segmented: Whether to save segmented item images
            
        Returns:
            Dictionary with processing results
        """
        print(f"\n{'='*60}")
        print(f"Processing outfit for user: {user_id}")
        print(f"Image: {image_path}")
        print(f"{'='*60}\n")
        
        results = {
            "user_id": user_id,
            "image_path": image_path,
            "detections": {},
            "segmented_items": {},
            "classified_items": [],
            "wardrobe_updates": []
        }
        
        # STEP 2: Detect clothing items
        print("STEP 2: Detecting clothing items...")
        detections = self.detector.detect(image_path)
        results["detections"] = {
            k: len(v) for k, v in detections.items()
        }
        print(f"✓ Detected items: {results['detections']}")
        
        # Save detection visualization
        try:
            viz_path = config.UPLOAD_DIR / f"{user_id}_detections.jpg"
            self.detector.visualize_detections(image_path, detections, str(viz_path))
            results["detection_visualization_path"] = str(viz_path)
        except Exception as e:
            print(f"⚠ Could not save detection visualization: {e}")
        
        if not detections:
            print("⚠ No clothing items detected!")
            print("💡 Tip: Default YOLO model may not detect specific clothing items.")
            print("   Consider using a fashion-trained YOLO model or fine-tuning.")
            # Still add wardrobe summary even if no items detected
            summary = self.wardrobe.get_wardrobe_summary(user_id)
            results["wardrobe_summary"] = summary
            return results
        
        # STEP 3: Segment clothing items
        if self.segmenter and save_segmented:
            print("\nSTEP 3: Segmenting clothing items...")
            segmented_dir = config.UPLOAD_DIR / f"{user_id}_segmented"
            segmented_dir.mkdir(exist_ok=True)
            
            segmented_items = self.segmenter.segment_all_items(
                image_path,
                detections,
                str(segmented_dir)
            )
            results["segmented_items"] = segmented_items
            print(f"✓ Segmented {sum(len(v) for v in segmented_items.values())} items")
        else:
            # Use bounding boxes as placeholders
            segmented_items = {}
            for category, boxes in detections.items():
                segmented_items[category] = [f"{category}_placeholder.png"] * len(boxes)
        
        # STEP 4: Classify attributes
        print("\nSTEP 4: Classifying attributes...")
        classified_items = []
        
        for category, item_paths in segmented_items.items():
            for item_path in item_paths:
                if Path(item_path).exists() or not save_segmented:
                    print(f"  Classifying {category}...")
                    attributes = self.classifier.classify_attributes(item_path, category)
                    classified_items.append({
                        "category": category,
                        "image": item_path,
                        "attributes": attributes
                    })
                    print(f"    ✓ Color: {attributes['color']['color']}, "
                          f"Pattern: {attributes['pattern']['pattern']}, "
                          f"Confidence: {attributes['confidence']:.2f}")
        
        results["classified_items"] = classified_items
        
        # STEP 5: Store in Digital Wardrobe
        print("\nSTEP 5: Storing in Digital Wardrobe...")
        wardrobe_updates = []
        
        for item in classified_items:
            # Copy image to wardrobe directory if it exists
            item_image_path = item["image"]
            if Path(item_image_path).exists():
                wardrobe_image_dir = config.WARDROBE_DIR / user_id / "images"
                wardrobe_image_dir.mkdir(parents=True, exist_ok=True)
                
                # Copy image
                new_image_path = wardrobe_image_dir / Path(item_image_path).name
                shutil.copy2(item_image_path, new_image_path)
                item["attributes"]["image"] = str(new_image_path)
            
            # Add to wardrobe
            wardrobe_item = self.wardrobe.add_item(
                user_id,
                item["category"],
                item["attributes"]
            )
            wardrobe_updates.append(wardrobe_item)
            print(f"  ✓ Added {item['category']} to wardrobe")
        
        results["wardrobe_updates"] = wardrobe_updates
        
        # Get wardrobe summary
        summary = self.wardrobe.get_wardrobe_summary(user_id)
        results["wardrobe_summary"] = summary
        
        print(f"\n{'='*60}")
        print("✅ Processing complete!")
        print(f"Total items in wardrobe: {summary['total_items']}")
        print(f"{'='*60}\n")
        
        return results
