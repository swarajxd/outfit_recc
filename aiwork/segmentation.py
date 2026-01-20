"""Clothing Item Segmentation using SAM (Segment Anything Model)"""

import cv2
import numpy as np
from PIL import Image
import torch
import torch.nn.functional as F
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import config

# Check for SAM availability
try:
    from segment_anything import sam_model_registry, SamPredictor
    SAM_AVAILABLE = True
except ImportError:
    SAM_AVAILABLE = False

# Check for torchvision (for DeepLabV3)
try:
    import torchvision.models.segmentation as segmentation_models
    DEEPLAB_AVAILABLE = True
except ImportError:
    DEEPLAB_AVAILABLE = False

class ClothingSegmenter:
    """Segments clothing items from outfit images using SAM"""
    
    def __init__(self, model_path: Optional[str] = None, device: str = "auto"):
        """
        Initialize SAM model for segmentation
        
        Args:
            model_path: Path to SAM checkpoint. If None, downloads default.
            device: Device to run on ('cuda', 'cpu', or 'auto')
        """
        if device == "auto":
            device = "cuda" if torch.cuda.is_available() else "cpu"
        
        self.device = device
        
        # Check for trained fashion segmentation model first
        # Try BASE_DIR first, then MODELS_DIR as fallback
        trained_model = None
        if (config.BASE_DIR / "fashion_segmentation_best_deeplabv3.pth").exists():
            trained_model = config.BASE_DIR / "fashion_segmentation_best_deeplabv3.pth"
        elif (config.MODELS_DIR / "fashion_segmentation_best_deeplabv3.pth").exists():
            trained_model = config.MODELS_DIR / "fashion_segmentation_best_deeplabv3.pth"
        
        use_trained = False
        
        if model_path is None:
            # Try trained model first
            if trained_model and trained_model.exists():
                print(f"✓ Found trained fashion segmentation model: {trained_model}")
                use_trained = True
                model_path = trained_model
            else:
                # Fallback to SAM
                if not SAM_AVAILABLE:
                    raise ImportError("SAM not available. Install: pip install segment-anything")
                model_path = config.MODELS_DIR / config.SAM_MODEL
                if not model_path.exists():
                    print(f"SAM model not found at {model_path}")
                    print("Please download from:", config.SAM_CHECKPOINT_URL)
                    print("\n💡 Tip: Train a model using train_segmentation.py for better accuracy")
                    raise FileNotFoundError(f"SAM model not found: {model_path}")
        
        # Load trained DeepLabV3 model if available
        if use_trained or (str(model_path).endswith("deeplabv3.pth") and DEEPLAB_AVAILABLE):
            self._load_trained_model(model_path)
            self.use_sam = False
            return
        
        # Load SAM model
        if not SAM_AVAILABLE:
            raise ImportError("SAM not available. Install: pip install segment-anything")
        
        # Determine model type from filename
        if "vit_h" in str(model_path):
            model_type = "vit_h"
        elif "vit_l" in str(model_path):
            model_type = "vit_l"
        elif "vit_b" in str(model_path):
            model_type = "vit_b"
        else:
            model_type = "vit_h"  # Default
        
        sam = sam_model_registry[model_type](checkpoint=str(model_path))
        sam.to(device=device)
        
        self.predictor = SamPredictor(sam)
        self.model_type = model_type
        self.use_sam = True
    
    def _load_trained_model(self, model_path: Path):
        """Load trained DeepLabV3 model"""
        if not DEEPLAB_AVAILABLE:
            raise ImportError("torchvision not available for DeepLabV3")
        
        print(f"Loading trained model from {model_path}...")
        checkpoint = torch.load(model_path, map_location=self.device)
        
        # Create model (same architecture as training)
        num_classes = checkpoint.get('num_classes', 2)
        self.model = segmentation_models.deeplabv3_resnet50(
            pretrained=False,
            num_classes=21  # Default, will modify last layer
        )
        # Replace classifier for our number of classes
        self.model.classifier[4] = torch.nn.Conv2d(256, num_classes, kernel_size=1)
        
        # Load weights - filter out aux_classifier keys (only used during training)
        state_dict = checkpoint['model_state_dict']
        # Remove aux_classifier keys if present (they're only for training)
        filtered_state_dict = {k: v for k, v in state_dict.items() 
                             if not k.startswith('aux_classifier')}
        
        # Load the filtered state dict
        self.model.load_state_dict(filtered_state_dict, strict=False)
        self.model.to(self.device)
        self.model.eval()
        
        self.model_type = checkpoint.get('model_type', 'deeplabv3')
        print(f"✓ Loaded {self.model_type} model (IoU: {checkpoint.get('val_iou', 0):.4f})")
    
    def segment_from_bbox(self, image_path: str, bbox: Tuple[int, int, int, int], 
                         category: str = None) -> np.ndarray:
        """
        Segment clothing item from bounding box with improved accuracy
        
        Args:
            image_path: Path to outfit image
            bbox: Bounding box (x1, y1, x2, y2)
            category: Clothing category (tshirt, jeans, shoes) for better prompts
            
        Returns:
            Binary mask (numpy array)
        """
        # Load image
        image = cv2.imread(image_path)
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        h, w = image_rgb.shape[:2]
        
        # Use trained model if available
        if not self.use_sam:
            return self._segment_with_trained_model(image_rgb, bbox, category)
        
        # Use SAM
        # Set image in predictor
        self.predictor.set_image(image_rgb)
        
        # Convert bbox to center point and box format for SAM
        x1, y1, x2, y2 = bbox
        box = np.array([x1, y1, x2, y2])
        
        # Calculate center point of bounding box for point prompt
        center_x = (x1 + x2) // 2
        center_y = (y1 + y2) // 2
        
        # Adjust center point based on category for better results
        if category == "tshirt":
            # For t-shirt, use center but slightly lower to avoid head
            center_y = y1 + int((y2 - y1) * 0.6)
        elif category == "shoes":
            # For shoes, use center of foot area
            center_y = y1 + int((y2 - y1) * 0.5)
        
        # Use point prompt + box for better segmentation
        point_coords = np.array([[center_x, center_y]])
        point_labels = np.array([1])  # Positive point (foreground)
        
        # Get multiple masks and choose the best one
        masks, scores, logits = self.predictor.predict(
            point_coords=point_coords,
            point_labels=point_labels,
            box=box[None, :],
            multimask_output=True,  # Get multiple masks
        )
        
        # Choose mask with highest score
        best_mask_idx = np.argmax(scores)
        mask = masks[best_mask_idx]
        
        # Refine mask to remove skin tones and non-clothing areas
        mask = self._refine_mask(mask, image_rgb, bbox, category)
        
        return mask
    
    def _segment_with_trained_model(self, image_rgb: np.ndarray, 
                                   bbox: Tuple[int, int, int, int],
                                   category: str = None) -> np.ndarray:
        """Segment using trained DeepLabV3 model with production-quality post-processing"""
        x1, y1, x2, y2 = bbox
        orig_h, orig_w = image_rgb.shape[:2]
        
        # Use larger context for better segmentation (DeepLabV3 benefits from context)
        padding = max(50, int(min(x2-x1, y2-y1) * 0.3))  # 30% padding or min 50px
        crop_x1 = max(0, x1 - padding)
        crop_y1 = max(0, y1 - padding)
        crop_x2 = min(orig_w, x2 + padding)
        crop_y2 = min(orig_h, y2 + padding)
        
        crop = image_rgb[crop_y1:crop_y2, crop_x1:crop_x2].copy()
        crop_h, crop_w = crop.shape[:2]
        
        if crop_h == 0 or crop_w == 0:
            return np.zeros((orig_h, orig_w), dtype=bool)
        
        # Preprocess - use higher resolution for better quality
        from torchvision import transforms
        target_size = 640  # Higher resolution for better quality
        transform = transforms.Compose([
            transforms.ToPILImage(),
            transforms.Resize((target_size, target_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        
        input_tensor = transform(crop).unsqueeze(0).to(self.device)
        
        # Predict with test-time augmentation (flip and average)
        with torch.no_grad():
            # Forward pass
            output = self.model(input_tensor)['out']
            
            # Horizontal flip augmentation
            input_tensor_flipped = torch.flip(input_tensor, dims=[3])
            output_flipped = self.model(input_tensor_flipped)['out']
            output_flipped = torch.flip(output_flipped, dims=[3])
            
            # Average predictions
            output = (output + output_flipped) / 2.0
            
            # Get probabilities
            probs = F.softmax(output, dim=1)
            foreground_prob = probs[0, 1, :, :].cpu().numpy()
            
            # Resize probability map to crop size
            if foreground_prob.shape != (crop_h, crop_w):
                foreground_prob = cv2.resize(foreground_prob, (crop_w, crop_h), 
                                            interpolation=cv2.INTER_LINEAR)
            
            # Use adaptive thresholding based on probability distribution
            # Find optimal threshold using Otsu's method on probabilities
            prob_uint8 = (foreground_prob * 255).astype(np.uint8)
            _, binary_mask = cv2.threshold(prob_uint8, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            pred_mask = (binary_mask > 127).astype(np.uint8)
            
            # If Otsu fails or mask is too small, use percentile-based threshold
            if np.sum(pred_mask) < crop_h * crop_w * 0.01:  # Less than 1% of crop
                threshold = np.percentile(foreground_prob, 50)  # Median
                pred_mask = (foreground_prob > threshold).astype(np.uint8)
        
        # Create full-size mask
        full_mask = np.zeros((orig_h, orig_w), dtype=bool)
        full_mask[crop_y1:crop_y2, crop_x1:crop_x2] = (pred_mask > 0)
        
        # Apply CRF-like refinement using GrabCut for better boundaries
        full_mask = self._refine_with_grabcut(image_rgb, full_mask, bbox, category)
        
        # Final refinement
        full_mask = self._refine_mask(full_mask.astype(float), image_rgb, bbox, category)
        
        return full_mask.astype(bool)
    
    def _refine_with_grabcut(self, image_rgb: np.ndarray, mask: np.ndarray, 
                            bbox: Tuple[int, int, int, int], category: str = None) -> np.ndarray:
        """Refine mask using GrabCut algorithm for better boundaries"""
        x1, y1, x2, y2 = bbox
        h, w = image_rgb.shape[:2]
        
        # Only apply to bbox region
        region_mask = np.zeros((h, w), dtype=np.uint8)
        region_mask[y1:y2, x1:x2] = cv2.GC_PR_FGD  # Probably foreground
        
        # Set mask areas
        region_mask[mask > 0] = cv2.GC_FGD  # Definitely foreground
        region_mask[mask == 0] = cv2.GC_BGD  # Background
        
        # Expand background slightly around bbox
        padding = 10
        region_mask[max(0, y1-padding):y1, max(0, x1-padding):min(w, x2+padding)] = cv2.GC_BGD
        region_mask[y2:min(h, y2+padding), max(0, x1-padding):min(w, x2+padding)] = cv2.GC_BGD
        region_mask[y1:y2, max(0, x1-padding):x1] = cv2.GC_BGD
        region_mask[y1:y2, x2:min(w, x2+padding)] = cv2.GC_BGD
        
        # Convert image to BGR for GrabCut
        img_bgr = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)
        
        # Initialize models for GrabCut
        bgd_model = np.zeros((1, 65), np.float64)
        fgd_model = np.zeros((1, 65), np.float64)
        
        try:
            # Run GrabCut (5 iterations for quality)
            cv2.grabCut(img_bgr, region_mask, None, bgd_model, fgd_model, 
                       iterCount=5, mode=cv2.GC_INIT_WITH_MASK)
            
            # Create refined mask
            refined_mask = np.where((region_mask == cv2.GC_FGD) | (region_mask == cv2.GC_PR_FGD), 
                                   1, 0).astype(bool)
            
            # Only update the bbox region
            result_mask = mask.copy()
            result_mask[y1:y2, x1:x2] = refined_mask[y1:y2, x1:x2]
            
            return result_mask
        except:
            # If GrabCut fails, return original mask
            return mask
    
    def _refine_mask(self, mask: np.ndarray, image: np.ndarray, 
                    bbox: Tuple[int, int, int, int], category: str = None) -> np.ndarray:
        """
        Refine mask to remove skin tones, faces, and other non-clothing areas
        
        Args:
            mask: Binary mask
            image: RGB image
            bbox: Bounding box
            category: Clothing category
            
        Returns:
            Refined binary mask
        """
        x1, y1, x2, y2 = bbox
        h, w = mask.shape
        
        # Crop to bounding box region
        mask_crop = mask[y1:y2, x1:x2] if y2 <= h and x2 <= w else mask
        image_crop = image[y1:y2, x1:x2] if y2 <= h and x2 <= w else image
        
        if mask_crop.size == 0 or image_crop.size == 0:
            return mask
        
        # Convert to HSV for better skin detection
        image_hsv = cv2.cvtColor(image_crop, cv2.COLOR_RGB2HSV)
        
        # Define skin tone ranges in HSV
        # Lower and upper bounds for skin color
        lower_skin1 = np.array([0, 20, 70], dtype=np.uint8)
        upper_skin1 = np.array([20, 255, 255], dtype=np.uint8)
        lower_skin2 = np.array([170, 20, 70], dtype=np.uint8)
        upper_skin2 = np.array([180, 255, 255], dtype=np.uint8)
        
        # Create skin mask
        skin_mask1 = cv2.inRange(image_hsv, lower_skin1, upper_skin1)
        skin_mask2 = cv2.inRange(image_hsv, lower_skin2, upper_skin2)
        skin_mask = cv2.bitwise_or(skin_mask1, skin_mask2)
        skin_mask = skin_mask > 0
        
        # Remove skin areas from clothing mask
        refined_mask = mask_crop.copy().astype(bool)
        
        # Remove skin pixels from mask (but be less aggressive)
        # Only remove skin if it's a significant portion
        skin_ratio = np.sum(skin_mask & refined_mask) / max(np.sum(refined_mask), 1)
        if skin_ratio > 0.3:  # Only if >30% of mask is skin
            refined_mask[skin_mask] = False
        
        # For t-shirt, remove top portion (likely head/neck) - LESS aggressive
        # Only apply if mask is large enough
        if category == "tshirt" and refined_mask.shape[0] > 50:
            height = refined_mask.shape[0]
            # Remove only top 5% (very conservative to avoid splitting)
            top_remove = max(1, int(height * 0.05))
            if top_remove > 0 and top_remove < height:
                refined_mask[:top_remove, :] = False
        
        # For t-shirt, also remove arm areas (sides) - LESS aggressive
        # Only apply if mask is wide enough
        if category == "tshirt" and refined_mask.shape[1] > 50:
            width = refined_mask.shape[1]
            # Remove only outer 5% on each side (very conservative)
            side_remove = max(1, int(width * 0.05))
            if side_remove > 0 and side_remove < width:
                refined_mask[:, :side_remove] = False
                refined_mask[:, -side_remove:] = False
        
        # For shoes, remove very top portion (might include pants)
        # Only apply if mask is tall enough
        if category == "shoes" and refined_mask.shape[0] > 30:
            height = refined_mask.shape[0]
            top_remove = max(1, int(height * 0.05))
            if top_remove > 0 and top_remove < height:
                refined_mask[:top_remove, :] = False
        
        # For jeans/pants, be very conservative - don't remove anything
        # The model should handle pants segmentation well
        
        # Advanced morphological operations for production quality
        mask_h, mask_w = refined_mask.shape[:2]
        refined_mask_uint8 = refined_mask.astype(np.uint8) * 255
        
        # Step 1: Remove small noise (opening)
        kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        refined_mask_uint8 = cv2.morphologyEx(refined_mask_uint8, 
                                              cv2.MORPH_OPEN, kernel_open, iterations=1)
        
        # Step 2: Fill gaps and holes (closing)
        kernel_size = min(7, max(3, min(mask_h, mask_w) // 30))
        kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
        refined_mask_uint8 = cv2.morphologyEx(refined_mask_uint8, 
                                              cv2.MORPH_CLOSE, kernel_close, iterations=2)
        
        # Step 3: Fill internal holes using flood fill
        # Create a mask with border
        h, w = refined_mask_uint8.shape
        mask_filled = refined_mask_uint8.copy()
        mask_temp = np.zeros((h + 2, w + 2), np.uint8)
        mask_temp[1:-1, 1:-1] = refined_mask_uint8
        
        # Flood fill from borders to find background
        cv2.floodFill(mask_filled, mask_temp, (0, 0), 255)
        mask_filled = mask_temp[1:-1, 1:-1]
        
        # Invert to get holes
        holes = cv2.bitwise_not(mask_filled)
        # Fill holes that are smaller than 5% of mask area
        max_hole_area = int(mask_h * mask_w * 0.05)
        contours, _ = cv2.findContours(holes, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for contour in contours:
            if cv2.contourArea(contour) < max_hole_area:
                cv2.drawContours(refined_mask_uint8, [contour], -1, 255, -1)
        
        # Step 4: Smooth edges using Gaussian blur + threshold
        blurred = cv2.GaussianBlur(refined_mask_uint8, (5, 5), 0)
        refined_mask_uint8 = (blurred > 127).astype(np.uint8) * 255
        
        refined_mask = (refined_mask_uint8 > 0).astype(bool)
        
        # Additional gap filling: if mask is split, try to connect largest components
        if category == "tshirt" or category == "shirt":
            # Find connected components
            num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
                refined_mask_uint8, connectivity=8
            )
            
            if num_labels > 2:  # More than background + 1 component (split detected)
                # Find largest component
                largest_label = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
                # Keep only largest component
                refined_mask = (labels == largest_label).astype(bool)
        
        # Ensure mask is not empty
        if np.sum(refined_mask) < 100:  # If too small, use original
            refined_mask = mask_crop.astype(bool)
        
        # Smooth edges to reduce jaggedness
        if np.sum(refined_mask) > 100:
            # Apply Gaussian blur to smooth edges
            refined_mask_uint8 = refined_mask.astype(np.uint8) * 255
            blurred = cv2.GaussianBlur(refined_mask_uint8, (5, 5), 0)
            refined_mask = (blurred > 127).astype(bool)
        
        # Fill in the original mask with refined version
        if y2 <= h and x2 <= w and y1 >= 0 and x1 >= 0:
            # Ensure we don't go out of bounds
            actual_y2 = min(y2, h)
            actual_x2 = min(x2, w)
            actual_h = actual_y2 - y1
            actual_w = actual_x2 - x1
            
            if actual_h > 0 and actual_w > 0:
                # Resize refined_mask if needed (use INTER_NEAREST to preserve binary nature)
                if refined_mask.shape[0] != actual_h or refined_mask.shape[1] != actual_w:
                    refined_mask = cv2.resize(refined_mask.astype(np.uint8), 
                                             (actual_w, actual_h), 
                                             interpolation=cv2.INTER_NEAREST) > 0
                # Ensure we don't overwrite with empty mask if original had content
                if np.sum(refined_mask) > 0:
                    mask[y1:actual_y2, x1:actual_x2] = refined_mask
        
        return mask
    
    def extract_clothing_item(self, image_path: str, mask: np.ndarray, 
                             output_path: str, transparent: bool = True):
        """
        Extract clothing item with transparent background
        
        Args:
            image_path: Path to original image
            mask: Binary mask from segmentation
            output_path: Path to save extracted item
            transparent: If True, use transparent background
        """
        # Load original image
        img = cv2.imread(image_path)
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Convert mask to 3-channel
        mask_3d = np.stack([mask] * 3, axis=-1).astype(np.uint8) * 255
        
        # Apply mask
        if transparent:
            # Create RGBA image
            img_rgba = np.zeros((img_rgb.shape[0], img_rgb.shape[1], 4), dtype=np.uint8)
            img_rgba[:, :, :3] = img_rgb
            img_rgba[:, :, 3] = (mask * 255).astype(np.uint8)
            
            # Save as PNG with transparency
            pil_img = Image.fromarray(img_rgba, 'RGBA')
            pil_img.save(output_path, 'PNG')
        else:
            # White background
            masked_img = img_rgb * mask_3d + (1 - mask_3d) * 255
            pil_img = Image.fromarray(masked_img.astype(np.uint8), 'RGB')
            pil_img.save(output_path, 'PNG')
    
    def segment_all_items(self, image_path: str, 
                         detections: Dict[str, List[Tuple[int, int, int, int]]],
                         output_dir: str) -> Dict[str, List[str]]:
        """
        Segment all detected clothing items
        
        Args:
            image_path: Path to outfit image
            detections: Detection results from ClothingDetector
            output_dir: Directory to save segmented items
            
        Returns:
            Dictionary mapping categories to list of saved image paths
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        segmented_items = {}
        
        for category, boxes in detections.items():
            segmented_items[category] = []
            
            for idx, bbox in enumerate(boxes):
                # Segment item with category info for better results
                mask = self.segment_from_bbox(image_path, bbox, category=category)
                
                # Save segmented item
                item_filename = f"{category}_{idx}.png"
                item_path = output_path / item_filename
                
                self.extract_clothing_item(
                    image_path, 
                    mask, 
                    str(item_path),
                    transparent=True
                )
                
                segmented_items[category].append(str(item_path))
        
        return segmented_items
