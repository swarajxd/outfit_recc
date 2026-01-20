"""Digital Wardrobe Storage System"""

import json
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
import config

class DigitalWardrobe:
    """Manages digital wardrobe storage and retrieval"""
    
    def __init__(self, wardrobe_dir: str = None):
        """
        Initialize wardrobe storage
        
        Args:
            wardrobe_dir: Directory to store wardrobe data
        """
        self.wardrobe_dir = Path(wardrobe_dir or config.WARDROBE_DIR)
        self.wardrobe_dir.mkdir(parents=True, exist_ok=True)
        
        # Wardrobe file path
        self.wardrobe_file = self.wardrobe_dir / "wardrobe.json"
        
        # Initialize wardrobe structure
        self.wardrobe = self._load_wardrobe()
    
    def _load_wardrobe(self) -> Dict:
        """Load wardrobe from JSON file"""
        if self.wardrobe_file.exists():
            with open(self.wardrobe_file, 'r') as f:
                return json.load(f)
        else:
            return {}
    
    def _save_wardrobe(self):
        """Save wardrobe to JSON file"""
        with open(self.wardrobe_file, 'w') as f:
            json.dump(self.wardrobe, f, indent=2)
    
    def get_user_wardrobe(self, user_id: str) -> Dict:
        """
        Get wardrobe for a specific user
        
        Args:
            user_id: User identifier
            
        Returns:
            User's wardrobe dictionary
        """
        if user_id not in self.wardrobe:
            self.wardrobe[user_id] = {
                "user_id": user_id,
                "created_at": datetime.now().isoformat(),
                "wardrobe": {
                    "tshirts": [],
                    "jeans": [],
                    "shoes": [],
                    "watches": [],
                    "caps": [],
                    "bags": []
                }
            }
            self._save_wardrobe()
        
        return self.wardrobe[user_id]
    
    def add_item(self, user_id: str, item_type: str, item_data: Dict):
        """
        Add a clothing item to user's wardrobe
        
        Args:
            user_id: User identifier
            item_type: Type of item (tshirt, jeans, shoes, etc.)
            item_data: Item data including image path and attributes
        """
        user_wardrobe = self.get_user_wardrobe(user_id)
        
        # Map item_type to wardrobe category
        category_map = {
            "tshirt": "tshirts",
            "shirt": "tshirts",
            "jeans": "jeans",
            "pants": "jeans",
            "shoes": "shoes",
            "watch": "watches",
            "cap": "caps",
            "hat": "caps",
            "bag": "bags"
        }
        
        category = category_map.get(item_type.lower(), "tshirts")
        
        # Create item entry
        item_entry = {
            "id": f"{item_type}_{len(user_wardrobe['wardrobe'][category]) + 1}",
            "image": item_data.get("image", ""),
            "color": item_data.get("color", {}).get("color", "unknown"),
            "pattern": item_data.get("pattern", {}).get("pattern", "unknown"),
            "attributes": item_data,
            "added_at": datetime.now().isoformat()
        }
        
        # Add type-specific attributes
        if "fit" in item_data:
            item_entry["fit"] = item_data["fit"].get("fit", "unknown")
        if "shade" in item_data:
            item_entry["shade"] = item_data["shade"].get("shade", "unknown")
        if "sleeve_type" in item_data:
            item_entry["sleeve_type"] = item_data["sleeve_type"].get("sleeve", "unknown")
        if "shoe_type" in item_data:
            item_entry["shoe_type"] = item_data["shoe_type"].get("type", "unknown")
        
        # Add to wardrobe
        user_wardrobe["wardrobe"][category].append(item_entry)
        user_wardrobe["updated_at"] = datetime.now().isoformat()
        
        self._save_wardrobe()
        
        return item_entry
    
    def get_items_by_category(self, user_id: str, category: str) -> List[Dict]:
        """
        Get all items in a specific category
        
        Args:
            user_id: User identifier
            category: Category name (tshirts, jeans, shoes, etc.)
            
        Returns:
            List of items in that category
        """
        user_wardrobe = self.get_user_wardrobe(user_id)
        return user_wardrobe["wardrobe"].get(category, [])
    
    def search_items(self, user_id: str, filters: Dict) -> List[Dict]:
        """
        Search items by filters (color, pattern, etc.)
        
        Args:
            user_id: User identifier
            filters: Dictionary of filters (e.g., {"color": "black", "pattern": "solid"})
            
        Returns:
            List of matching items
        """
        user_wardrobe = self.get_user_wardrobe(user_id)
        all_items = []
        
        # Collect all items
        for category_items in user_wardrobe["wardrobe"].values():
            all_items.extend(category_items)
        
        # Apply filters
        filtered_items = []
        for item in all_items:
            match = True
            for key, value in filters.items():
                if key in item:
                    if isinstance(item[key], dict):
                        if item[key].get(key.split("_")[0]) != value:
                            match = False
                            break
                    elif item[key] != value:
                        match = False
                        break
                else:
                    match = False
                    break
            
            if match:
                filtered_items.append(item)
        
        return filtered_items
    
    def get_wardrobe_summary(self, user_id: str) -> Dict:
        """
        Get summary statistics of user's wardrobe
        
        Args:
            user_id: User identifier
            
        Returns:
            Summary dictionary with counts per category
        """
        user_wardrobe = self.get_user_wardrobe(user_id)
        
        summary = {
            "user_id": user_id,
            "total_items": 0,
            "by_category": {}
        }
        
        for category, items in user_wardrobe["wardrobe"].items():
            count = len(items)
            summary["by_category"][category] = count
            summary["total_items"] += count
        
        return summary
