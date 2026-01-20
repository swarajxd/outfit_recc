"""Clothing Item Detection using YOLOv8 with pose estimation fallback"""

import cv2
import numpy as np
from ultralytics import YOLO
from pathlib import Path
from typing import Dict, List, Tuple
import config

# Try to import pose-based detector
try:
    from detection_pose import PoseBasedDetector, MEDIAPIPE_AVAILABLE
except ImportError:
    MEDIAPIPE_AVAILABLE = False
    PoseBasedDetector = None

class ClothingDetector:
    """Detects clothing items in outfit images using YOLOv8 with pose estimation fallback"""
    
    def __init__(self, model_path: str = None, use_pose_fallback: bool = True):
        """
        Initialize YOLO model for clothing detection
        
        Args:
            model_path: Path to custom YOLO model. If None, uses default.
            use_pose_fallback: Use pose estimation for better detection (if available)
        """
        if model_path is None:
            model_path = config.YOLO_MODEL
        
        self.model = YOLO(model_path)
        self.clothing_classes = config.CLOTHING_CLASSES
        self.use_pose_fallback = use_pose_fallback and MEDIAPIPE_AVAILABLE
        
        if self.use_pose_fallback:
            try:
                self.pose_detector = PoseBasedDetector()
                print("✓ Pose-based detection available for better accuracy")
            except:
                self.use_pose_fallback = False
                print("⚠ Pose detection not available, using YOLO fallback")
        
    def detect(self, image_path: str) -> Dict[str, List[Tuple[int, int, int, int]]]:
        """
        Detect clothing items in an outfit image
        
        Args:
            image_path: Path to the outfit image
            
        Returns:
            Dictionary mapping clothing types to bounding boxes
            Example: {
                "tshirt": [(x1, y1, x2, y2), ...],
                "jeans": [(x1, y1, x2, y2)],
                ...
            }
        """
        # Run YOLO detection
        results = self.model(
            image_path,
            conf=config.YOLO_CONFIDENCE,
            iou=config.YOLO_IOU
        )
        
        detections: Dict[str, List[Tuple[int, int, int, int]]] = {}
        person_boxes: List[Tuple[int, int, int, int]] = []
        detected_classes = set()
        debug_dets: List[Tuple[str, float]] = []
        
        # Process results
        for result in results:
            boxes = result.boxes
            if boxes is not None:
                for box in boxes:
                    # Get class name
                    class_id = int(box.cls[0])
                    class_name = result.names[class_id].lower()
                    detected_classes.add(class_name)
                    try:
                        conf = float(box.conf[0])
                        debug_dets.append((class_name, conf))
                    except Exception:
                        pass
                    
                    # Store person detections for fallback
                    if class_name == "person":
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        person_boxes.append((int(x1), int(y1), int(x2), int(y2)))
                    
                    # Map to our clothing categories
                    category = self._map_to_category(class_name)
                    if category:
                        # Get bounding box coordinates
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        bbox = (int(x1), int(y1), int(x2), int(y2))
                        
                        if category not in detections:
                            detections[category] = []
                        detections[category].append(bbox)
        
        # Debug: Show what YOLO detected
        if detected_classes:
            print(f"  YOLO detected classes: {', '.join(sorted(detected_classes))}")
            if debug_dets:
                top = sorted(debug_dets, key=lambda x: x[1], reverse=True)[:8]
                print("  YOLO top conf:", ", ".join([f"{n}:{c:.2f}" for n, c in top]))
        
        # Fallback: Use pose estimation if available, otherwise use bounding box regions
        if not detections:
            if self.use_pose_fallback:
                print("  ⚠ No clothing items detected by YOLO, trying pose-based detection...")
                pose_detections = self.pose_detector.detect(image_path)
                if pose_detections:
                    print(f"  ✓ Pose detection found {sum(len(v) for v in pose_detections.values())} clothing regions")
                    return pose_detections
                else:
                    print("  ⚠ Pose detection also failed, using bounding box fallback")
            
            # Final fallback: Use person bounding box
            if person_boxes:
                print("  ⚠ No specific clothing items detected, using person bounding box as fallback")
                print("  💡 Creating approximate regions: upper body (tshirt), lower body (jeans), feet (shoes)")
                detections = self._create_fallback_regions(person_boxes, image_path)
        else:
            # If we detected something but missed key wardrobe categories, backfill from person box.
            # This is especially important because the current trained YOLO dataset only includes
            # tshirt+jeans (no shoes/accessories), so those will never be detected by YOLO.
            if person_boxes:
                want = ["tshirt", "shoes"]
                missing = [k for k in want if k not in detections]
                if missing:
                    print(f"  ⚠ YOLO missed {missing}; adding approximate regions from person box fallback")
                    fallback = self._create_fallback_regions(person_boxes, image_path)
                    for k in missing:
                        if k in fallback:
                            detections[k] = fallback[k]
            else:
                # If the model does not have a 'person' class (common with custom fashion YOLO),
                # we can still create reasonable regions from detected jeans boxes.
                if "jeans" in detections:
                    img = cv2.imread(image_path)
                    if img is not None:
                        img_h, img_w = img.shape[:2]
                        want = ["tshirt", "shoes"]
                        missing = [k for k in want if k not in detections]
                        if missing:
                            print(f"  ⚠ YOLO missed {missing}; synthesizing regions from jeans box")
                            synth = self._create_regions_from_jeans(detections["jeans"], img_w, img_h)
                            for k in missing:
                                if k in synth:
                                    detections[k] = synth[k]
        
        return detections

    def _create_regions_from_jeans(
        self,
        jeans_boxes: List[Tuple[int, int, int, int]],
        img_w: int,
        img_h: int
    ) -> Dict[str, List[Tuple[int, int, int, int]]]:
        """
        Create approximate tshirt/shoes regions from jeans detections.
        Useful when the custom YOLO model does not include the 'person' class.
        """
        if not jeans_boxes:
            return {}

        # Union of jeans boxes
        x1 = min(b[0] for b in jeans_boxes)
        y1 = min(b[1] for b in jeans_boxes)
        x2 = max(b[2] for b in jeans_boxes)
        y2 = max(b[3] for b in jeans_boxes)

        # Expand a bit horizontally for better coverage
        jw = max(1, x2 - x1)
        expand = int(jw * 0.15)
        ux1 = max(0, x1 - expand)
        ux2 = min(img_w, x2 + expand)

        regions: Dict[str, List[Tuple[int, int, int, int]]] = {}

        # tshirt region: from near top to jeans waistband (y1)
        tshirt_y1 = max(0, int(img_h * 0.05))
        tshirt_y2 = max(tshirt_y1 + 20, min(img_h, y1))
        if tshirt_y2 - tshirt_y1 >= 30 and ux2 - ux1 >= 40:
            regions["tshirt"] = [(ux1, tshirt_y1, ux2, tshirt_y2)]

        # shoes region: from jeans bottom (y2) to bottom of image
        shoes_y1 = max(0, min(img_h - 1, y2))
        shoes_y2 = min(img_h, shoes_y1 + int(img_h * 0.18))
        if shoes_y2 - shoes_y1 >= 25 and ux2 - ux1 >= 40:
            regions["shoes"] = [(ux1, shoes_y1, ux2, shoes_y2)]

        return regions
    
    def _create_fallback_regions(self, person_boxes: List[Tuple[int, int, int, int]], 
                                image_path: str = None) -> Dict[str, List[Tuple[int, int, int, int]]]:
        """
        Create approximate clothing regions from person bounding boxes
        Improved to exclude head/neck and focus on actual clothing areas
        
        Args:
            person_boxes: List of person bounding boxes
            image_path: Path to image for validation
            
        Returns:
            Dictionary with approximate clothing regions
        """
        detections = {}
        
        # Get image dimensions to check if shoes are visible
        img_h = None
        if image_path:
            import cv2
            img = cv2.imread(image_path)
            if img is not None:
                img_h = img.shape[0]
        
        for person_box in person_boxes:
            x1, y1, x2, y2 = person_box
            width = x2 - x1
            height = y2 - y1
            
            # Improved regions - exclude head/neck area
            # Head typically takes ~15-20% of person height
            head_height = int(height * 0.18)
            
            # T-shirt area: Skip head, focus on torso (neck to waist)
            # Start below head, end at ~50% of person height (waist level)
            tshirt_y1 = y1 + head_height  # Start below head
            tshirt_y2 = y1 + int(height * 0.5)  # End at waist
            tshirt_x1 = x1 + int(width * 0.05)  # Narrower margins
            tshirt_x2 = x2 - int(width * 0.05)
            
            # Jeans area: Waist to ankles (exclude feet)
            jeans_y1 = y1 + int(height * 0.5)  # Start at waist
            jeans_y2 = y1 + int(height * 0.85)  # End before feet
            jeans_x1 = x1 + int(width * 0.05)
            jeans_x2 = x2 - int(width * 0.05)
            
            # Add t-shirt and jeans always
            if "tshirt" not in detections:
                detections["tshirt"] = []
            detections["tshirt"].append((tshirt_x1, tshirt_y1, tshirt_x2, tshirt_y2))
            
            if "jeans" not in detections:
                detections["jeans"] = []
            detections["jeans"].append((jeans_x1, jeans_y1, jeans_x2, jeans_y2))
            
            # Only create shoes if person box extends near bottom of image
            shoes_visible = False
            if img_h is not None:
                # Person box should extend to at least 85% of image height for shoes to be visible
                person_bottom_ratio = y2 / img_h
                shoes_visible = person_bottom_ratio > 0.85
            else:
                # If we can't check, assume shoes might be visible if person box is tall enough
                # (at least 60% of typical person height)
                shoes_visible = height > 200  # Rough heuristic
            
            # Only add shoes if they're likely visible
            if shoes_visible:
                shoes_y1 = y1 + int(height * 0.85)  # Start at 85% (feet area)
                shoes_y2 = y2
                shoes_x1 = x1 + int(width * 0.15)  # Narrower, centered
                shoes_x2 = x2 - int(width * 0.15)
                
                shoes_width = shoes_x2 - shoes_x1
                shoes_height = shoes_y2 - shoes_y1
                
                # Only add if shoes box is reasonable size (at least 40x30 pixels)
                if shoes_width >= 40 and shoes_height >= 30:
                    if "shoes" not in detections:
                        detections["shoes"] = []
                    detections["shoes"].append((shoes_x1, shoes_y1, shoes_x2, shoes_y2))
                    print(f"  Created fallback regions: tshirt({tshirt_x2-tshirt_x1}x{tshirt_y2-tshirt_y1}), "
                          f"jeans({jeans_x2-jeans_x1}x{jeans_y2-jeans_y1}), "
                          f"shoes({shoes_x2-shoes_x1}x{shoes_y2-shoes_y1})")
                else:
                    print(f"  Created fallback regions: tshirt({tshirt_x2-tshirt_x1}x{tshirt_y2-tshirt_y1}), "
                          f"jeans({jeans_x2-jeans_x1}x{jeans_y2-jeans_y1}), "
                          f"shoes(skipped - box too small: {shoes_width}x{shoes_height})")
            else:
                print(f"  Created fallback regions: tshirt({tshirt_x2-tshirt_x1}x{tshirt_y2-tshirt_y1}), "
                      f"jeans({jeans_x2-jeans_x1}x{jeans_y2-jeans_y1}), "
                      f"shoes(skipped - person doesn't extend to bottom of image)")
        
        return detections
    
    def _map_to_category(self, class_name: str) -> str:
        """
        Map YOLO class name to our clothing category
        
        Args:
            class_name: Detected class name from YOLO
            
        Returns:
            Category name or None
        """
        class_name_lower = class_name.lower()
        
        for category, keywords in self.clothing_classes.items():
            if any(keyword in class_name_lower for keyword in keywords):
                return category
        
        return None
    
    def visualize_detections(self, image_path: str, detections: Dict, output_path: str):
        """
        Visualize detected bounding boxes on image
        
        Args:
            image_path: Path to original image
            detections: Detection results from detect()
            output_path: Path to save visualized image
        """
        img = cv2.imread(image_path)
        
        colors = {
            "tshirt": (0, 255, 0),
            "jeans": (255, 0, 0),
            "shoes": (0, 0, 255),
            "watch": (255, 255, 0),
            "cap": (255, 0, 255),
            "bag": (0, 255, 255)
        }
        
        for category, boxes in detections.items():
            color = colors.get(category, (128, 128, 128))
            for x1, y1, x2, y2 in boxes:
                cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
                cv2.putText(img, category, (x1, y1 - 10),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
        
        cv2.imwrite(output_path, img)
