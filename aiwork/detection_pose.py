"""Better clothing detection using pose estimation"""

import cv2
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import config

try:
    import mediapipe as mp
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    MEDIAPIPE_AVAILABLE = False
    print("⚠ MediaPipe not available. Install: pip install mediapipe")

class PoseBasedDetector:
    """Detect clothing regions using pose estimation"""
    
    def __init__(self):
        if not MEDIAPIPE_AVAILABLE:
            raise ImportError("MediaPipe required for pose-based detection")
        
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=True,
            model_complexity=2,
            enable_segmentation=False,
            min_detection_confidence=0.5
        )
        self.mp_drawing = mp.solutions.drawing_utils
    
    def detect(self, image_path: str) -> Dict[str, List[Tuple[int, int, int, int]]]:
        """
        Detect clothing regions using pose keypoints
        
        Args:
            image_path: Path to outfit image
            
        Returns:
            Dictionary mapping clothing types to bounding boxes
        """
        image = cv2.imread(image_path)
        if image is None:
            return {}
        
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        h, w = image_rgb.shape[:2]
        
        results = self.pose.process(image_rgb)
        detections = {}
        
        if not results.pose_landmarks:
            return {}
        
        landmarks = results.pose_landmarks.landmark
        
        # Get key body points
        def get_point(idx):
            lm = landmarks[idx]
            return (int(lm.x * w), int(lm.y * h))
        
        # Define keypoint indices (MediaPipe pose)
        # Upper body
        left_shoulder = get_point(11)  # Left shoulder
        right_shoulder = get_point(12)  # Right shoulder
        left_hip = get_point(23)  # Left hip
        right_hip = get_point(24)  # Right hip
        left_ankle = get_point(27)  # Left ankle
        right_ankle = get_point(28)  # Right ankle
        
        # T-shirt region: shoulders to waist
        if left_shoulder[1] > 0 and right_shoulder[1] > 0:
            # Use shoulders and hips to define t-shirt area
            shoulder_y = min(left_shoulder[1], right_shoulder[1])
            shoulder_x_min = min(left_shoulder[0], right_shoulder[0])
            shoulder_x_max = max(left_shoulder[0], right_shoulder[0])
            
            hip_y = max(left_hip[1], right_hip[1]) if left_hip[1] > 0 and right_hip[1] > 0 else shoulder_y + int(h * 0.3)
            
            # T-shirt bounding box
            tshirt_x1 = max(0, shoulder_x_min - int((shoulder_x_max - shoulder_x_min) * 0.2))
            tshirt_x2 = min(w, shoulder_x_max + int((shoulder_x_max - shoulder_x_min) * 0.2))
            tshirt_y1 = max(0, shoulder_y - int(h * 0.05))  # Slightly above shoulders
            tshirt_y2 = min(h, hip_y)
            
            if tshirt_x2 > tshirt_x1 and tshirt_y2 > tshirt_y1:
                detections["tshirt"] = [(tshirt_x1, tshirt_y1, tshirt_x2, tshirt_y2)]
        
        # Jeans/pants region: waist to ankles
        if left_hip[1] > 0 and right_hip[1] > 0:
            hip_y = min(left_hip[1], right_hip[1])
            hip_x_min = min(left_hip[0], right_hip[0])
            hip_x_max = max(left_hip[0], right_hip[0])
            
            # Use ankles if available, otherwise estimate
            if left_ankle[1] > 0 and right_ankle[1] > 0:
                ankle_y = max(left_ankle[1], right_ankle[1])
            else:
                ankle_y = hip_y + int(h * 0.4)  # Estimate
            
            jeans_x1 = max(0, hip_x_min - int((hip_x_max - hip_x_min) * 0.15))
            jeans_x2 = min(w, hip_x_max + int((hip_x_max - hip_x_min) * 0.15))
            jeans_y1 = hip_y
            jeans_y2 = min(h, ankle_y)
            
            if jeans_x2 > jeans_x1 and jeans_y2 > jeans_y1:
                detections["jeans"] = [(jeans_x1, jeans_y1, jeans_x2, jeans_y2)]
        
        # Shoes region: ankles to feet
        if left_ankle[1] > 0 and right_ankle[1] > 0:
            ankle_y = min(left_ankle[1], right_ankle[1])
            ankle_x_min = min(left_ankle[0], right_ankle[0])
            ankle_x_max = max(left_ankle[0], right_ankle[0])
            
            # Feet extend below ankles
            feet_y = min(h, ankle_y + int(h * 0.1))
            
            shoes_x1 = max(0, ankle_x_min - int((ankle_x_max - ankle_x_min) * 0.3))
            shoes_x2 = min(w, ankle_x_max + int((ankle_x_max - ankle_x_min) * 0.3))
            shoes_y1 = ankle_y
            shoes_y2 = feet_y
            
            # Only add if shoes are visible (near bottom of image)
            if shoes_y2 > h * 0.85:  # Feet extend to at least 85% of image height
                if shoes_x2 > shoes_x1 and shoes_y2 > shoes_y1:
                    detections["shoes"] = [(shoes_x1, shoes_y1, shoes_x2, shoes_y2)]
        
        return detections
