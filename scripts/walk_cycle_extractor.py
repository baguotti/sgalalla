import os
import numpy as np
import argparse
import sys
from PIL import Image

def extract_sprites(source_path, target_count=9, center_mode="face", output_name=None, start_index=0):
    if not os.path.exists(source_path):
        print(f"Error: File not found at {source_path}")
        return

    output_dir = os.path.dirname(os.path.abspath(source_path))
    
    if output_name:
        base_name = output_name
    else:
        base_name = os.path.splitext(os.path.basename(source_path))[0]
        if base_name.endswith("_Strip"):
            base_name = base_name[:-6]

    try:
        img = Image.open(source_path)
        img = img.convert("RGBA")
        strip = img
    except Exception as e:
        print(f"Error opening image: {e}")
        return

    width, height = strip.size
    print(f"Processing strip: {width}x{height}")

    # Analyze alpha channel
    arr = np.array(strip)
    alpha = arr[:, :, 3]
    
    # Use threshold to ignore noise (alpha < 10 is considered 0)
    # has_content = np.any(alpha > 10, axis=0) # Check columns
    # Actually, we need col_sums for splitting logic later.
    # Let's count how many pixels are > 10 in each column.
    threshold_mask = alpha > 10
    col_sums = np.sum(threshold_mask, axis=0)
    
    has_content = col_sums > 0
    starts = []
    ends = []
    in_sprite = False
    
    for i, active in enumerate(has_content):
        if active and not in_sprite:
            starts.append(i)
            in_sprite = True
        elif not active and in_sprite:
            ends.append(i)
            in_sprite = False
            
    if in_sprite:
        ends.append(width)
        
    blobs = list(zip(starts, ends))
    print(f"Initially detected {len(blobs)} sprites.")
    
    while len(blobs) < target_count:
        widest_idx = -1
        max_width = -1
        for i, (s, e) in enumerate(blobs):
            w = e - s
            if w > max_width:
                max_width = w
                widest_idx = i
        if widest_idx == -1:
            break
        s, e = blobs[widest_idx]
        blob_width = e - s
        search_start = s + int(blob_width * 0.25)
        search_end = s + int(blob_width * 0.75)
        local_sums = col_sums[search_start:search_end]
        if len(local_sums) == 0:
             split_point = s + blob_width // 2
        else:
             split_point = search_start + np.argmin(local_sums)
        blobs.pop(widest_idx)
        blobs.insert(widest_idx, (split_point + 1, e)) # Insert right first
        blobs.insert(widest_idx, (s, split_point)) # Insert left second
        blobs.sort(key=lambda x: x[0])

    for i, (s, e) in enumerate(blobs):
        if i >= target_count:
            break
            
        sprite_chunk = strip.crop((s, 0, e, height))
        bbox = sprite_chunk.getbbox()
        if not bbox:
            print(f"Frame {i} is empty?")
            continue
            
        
        original_y = bbox[1]
        
        sprite = sprite_chunk.crop(bbox)
        
        # Clean up leftovers by keeping only the largest connected component
        sprite = keep_largest_island(sprite)
        
        # Update dimensions after cleaning (though crop might not change, alpha does)
        # Actually should re-crop if island shrunk? Not strictly necessary but cleaner.
        new_bbox = sprite.getbbox()
        if new_bbox:
             sprite_w_offset, sprite_h_offset = new_bbox[0], new_bbox[1]
             sprite = sprite.crop(new_bbox)
             sprite_w, sprite_h = sprite.size
        else:
             print(f"Frame {i} became empty after cleanup. Skipping.")
             continue
        
        new_frame = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
        
        paste_x = 512 # Default center
        
        if center_mode == "face":
            # Face Locking Logic
            # Heuristic: Focus on the top 20% of the sprite's height
            scan_height = max(1, int(sprite_h * 0.2))
            top_slice = sprite.crop((0, 0, sprite_w, scan_height))
            top_bbox = top_slice.getbbox()
            
            if top_bbox:
                 # Calculate Center of Mass of Alpha for top slice
                 # This is more robust than bbox center if the head has wispy features on one side
                 scan_width = sprite_w
                 scan_alpha = np.array(top_slice)[:, :, 3]
                 col_weights = np.sum(scan_alpha, axis=0) # Sum alpha per column
                 total_alpha = np.sum(col_weights)
                 
                 if total_alpha > 0:
                     # Weighted average of X coordinates
                     x_coords = np.arange(scan_width)
                     face_center_x = int(np.sum(x_coords * col_weights) / total_alpha)
                 else:
                     face_center_x = (top_bbox[0] + top_bbox[2]) // 2
            else:
                 face_center_x = sprite_w // 2 # Fallback
            
            # Lock Face Center to canvas center
            paste_x = 512 - face_center_x
            
        elif center_mode == "body":
            # Simple body centering
            paste_x = (1024 - sprite_w) // 2
            
        # Y-axis: Preserve Y from original strip relative to top, PLUS any local cropping
        paste_y = original_y + sprite_h_offset
        
        if paste_y + sprite_h > 1024:
             print(f"Warning: Frame {i} clipped at bottom by {paste_y + sprite_h - 1024}px")
        
        new_frame.paste(sprite, (paste_x, paste_y))
        
        output_filename = f"{base_name}_{i + start_index:03d}.png".lower()
        output_path = os.path.join(output_dir, output_filename)
        new_frame.save(output_path)
        print(f"Saved: {output_path} (size: {sprite_w}x{sprite_h})")

def keep_largest_island(sprite):
    # Convert to array
    arr = np.array(sprite)
    alpha = arr[:, :, 3]
    h, w = alpha.shape
    
    # Binary mask: > 10 is content
    mask = (alpha > 10)
    visited = np.zeros_like(mask, dtype=bool)
    
    largest_island_mask = np.zeros_like(mask, dtype=bool)
    max_size = 0
    
    # Helper for neighbors
    def get_neighbors(r, c):
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nr, nc = r + dr, c + dc
            if 0 <= nr < h and 0 <= nc < w:
                yield nr, nc

    # Find islands using iterative DFS/BFS
    for r in range(h):
        for c in range(w):
            if mask[r, c] and not visited[r, c]:
                # Start new island
                current_island = []
                stack = [(r, c)]
                visited[r, c] = True
                size = 0
                
                while stack:
                    curr_r, curr_c = stack.pop()
                    current_island.append((curr_r, curr_c))
                    size += 1
                    
                    for nr, nc in get_neighbors(curr_r, curr_c):
                        if mask[nr, nc] and not visited[nr, nc]:
                            visited[nr, nc] = True
                            stack.append((nr, nc))
                
                if size > max_size:
                    max_size = size
                    # Clear previous largest
                    largest_island_mask.fill(False)
                    # Mark new largest
                    for ir, ic in current_island:
                        largest_island_mask[ir, ic] = True
                        
    # Apply mask: suppress everything NOT in largest island
    # Set alpha to 0 where mask is False
    # Copy original array
    cleaned_arr = arr.copy()
    cleaned_arr[~largest_island_mask, 3] = 0
    
    return Image.fromarray(cleaned_arr)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract sprites from a strip using alpha detection with Face Locking.")
    parser.add_argument("file", help="Path to the sprite strip image")
    parser.add_argument("--count", type=int, default=9, help="Target number of frames (default: 9)")
    parser.add_argument("--mode", choices=["face", "body"], default="face", help="Centering mode: 'face' locks the head X position, 'body' centers the whole sprite width (default: face)")
    parser.add_argument("--name", help="Custom output base name (e.g. 'fok'). Defaults to input filename.")
    parser.add_argument("--start-index", type=int, default=0, help="Starting index for file numbering (default: 0).")
    
    args = parser.parse_args()
    extract_sprites(args.file, args.count, args.mode, args.name, args.start_index)
