import sys
import os
from PIL import Image, ImageFilter

def remove_meta_ai_logo(image_path):
    if not os.path.exists(image_path):
        print(f"Error: File not found at {image_path}")
        return False
        
    try:
        img = Image.open(image_path)
        w, h = img.size
        
        # Define logo area in bottom-left (typically x: 10 to 90, y: h-95 to h-15 on 1024x1024)
        # We make it relative to the image size so it works on any resolution
        x_start = int(w * 0.01)
        x_end = int(w * 0.10)
        y_start = h - int(h * 0.10)
        y_end = h - int(h * 0.015)
        
        box_w = x_end - x_start
        box_h = y_end - y_start
        
        # We copy a patch from the right of the logo: x_end + 15px
        patch_x_start = x_end + int(w * 0.015)
        patch_x_end = patch_x_start + box_w
        
        # Ensure patch is within bounds
        if patch_x_end > w:
            patch_x_end = w
            patch_x_start = w - box_w
            
        patch = img.crop((patch_x_start, y_start, patch_x_end, y_end))
        
        # Create a feathered alpha mask to blend the patch smoothly
        mask = Image.new("L", (box_w, box_h), 255)
        # Apply Gaussian Blur to create soft feathering at the edges
        mask_blurred = mask.filter(ImageFilter.GaussianBlur(8))
        
        # Paste the patch over the logo with feathering
        img.paste(patch, (x_start, y_start), mask_blurred)
        
        # Safe format conversion for JPEG saving (prevent RGBA save error)
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            img = img.convert("RGB")
            
        # Save back the image replacing the original
        img.save(image_path, "JPEG", quality=95)
        print(f"Successfully removed watermark from {image_path}")
        return True
    except Exception as e:
        print(f"Error processing image {image_path}: {str(e)}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python image_cleaner.py <image_path>")
        sys.exit(1)
        
    img_path = sys.argv[1]
    success = remove_meta_ai_logo(img_path)
    sys.exit(0 if success else 1)
