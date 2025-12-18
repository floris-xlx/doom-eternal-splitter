import cv2
import numpy as np
import pyautogui
import os
import time
import datetime
import json
import asyncio
from colorama import Fore, Back, Style, init
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
import keyboard
import uuid

init(autoreset=True)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))

markers_root = os.path.join(ROOT_DIR, "markers")
screenshots_dir = os.path.join(ROOT_DIR, "screenshots_cache")
manual_screenshots_dir = os.path.join(ROOT_DIR, "screenshots")
log_file = os.path.join(ROOT_DIR, "log.txt")
matches_json_path = os.path.join(ROOT_DIR, "data", "matches.json")
manual_screenshots_json_path = os.path.join(ROOT_DIR, "data", "manual_screenshots.json")
keybindings_json_path = os.path.join(ROOT_DIR, "keybindings.json")

os.makedirs(markers_root, exist_ok=True)
os.makedirs(screenshots_dir, exist_ok=True)
os.makedirs(manual_screenshots_dir, exist_ok=True)
os.makedirs(os.path.dirname(matches_json_path), exist_ok=True)
os.makedirs(os.path.dirname(manual_screenshots_json_path), exist_ok=True)

templates = {}
for root, dirs, files in os.walk(markers_root):
    rel = os.path.relpath(root, markers_root)
    if rel == ".":
        marker_name = None
    else:
        marker_name = rel.replace("\\", "/")
    for fname in files:
        if fname.lower().endswith((".png", ".jpg", ".jpeg")):
            key = f"{marker_name}/{fname}" if marker_name else fname
            img_path = os.path.join(root, fname)
            templates[key] = cv2.imread(img_path, cv2.IMREAD_COLOR)

log_buffer = []
last_dump = time.time()

try:
    from .livesplit_api import LiveSplitClient
except ImportError:
    from livesplit_api import LiveSplitClient

livesplit_client = LiveSplitClient()


def load_keybindings():
    default_keybindings = {"f1": "imp", "f2": "soldier"}

    try:
        if os.path.exists(keybindings_json_path):
            with open(keybindings_json_path, "r") as f:
                return json.load(f)
        else:
            with open(keybindings_json_path, "w") as f:
                json.dump(default_keybindings, f, indent=2)
            return default_keybindings
    except Exception:
        return default_keybindings


def save_manual_screenshot(category):
    timestamp = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        hours=2
    )
    ts_str = timestamp.strftime("%Y-%m-%d %H:%M:%S")
    filename = f"{int(time.time()*1000)}_{uuid.uuid4().hex[:8]}.png"

    category_dir = os.path.join(manual_screenshots_dir, f"{category}s")
    os.makedirs(category_dir, exist_ok=True)

    filepath = os.path.join(category_dir, filename)
    screenshot = pyautogui.screenshot()
    screenshot.save(filepath)

    entry = {
        "filename": filename,
        "category": category,
        "path": filepath.replace("\\", "/"),
        "timestamp": ts_str,
        "screensize": {"width": screenshot.width, "height": screenshot.height},
    }

    try:
        if os.path.exists(manual_screenshots_json_path):
            with open(manual_screenshots_json_path, "r") as f:
                data = json.load(f)
        else:
            data = []
    except Exception:
        data = []

    data.append(entry)

    with open(manual_screenshots_json_path, "w") as f:
        json.dump(data, f, indent=2)

    log_event(f"Manual screenshot saved: {category} -> {filepath}")


def setup_hotkeys():
    keybindings = load_keybindings()

    for key, category in keybindings.items():
        keyboard.add_hotkey(key, lambda cat=category: save_manual_screenshot(cat))

    log_event(f"Hotkeys configured: {keybindings}")


def log_event(msg):
    global log_buffer, last_dump
    timestamp = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        hours=2
    )
    entry = f"[{timestamp.strftime('%Y-%m-%d %H:%M:%S')} CEST] {msg}"
    log_buffer.append(entry)
    print(entry)
    if time.time() - last_dump >= 5:
        with open(log_file, "a") as f:
            f.write("\n".join(log_buffer) + "\n")
        log_buffer = []
        last_dump = time.time()


def get_full_screenshot():
    w, h = pyautogui.size()
    return pyautogui.screenshot(), (w, h)


def get_match_region(full_img):
    w, h = full_img.size
    region = (w // 2, 0, w, h // 2)
    return full_img.crop(region), (w // 2, 0)


def match_templates(full_screenshot):
    region_img, (offset_x, offset_y) = get_match_region(full_screenshot)
    matched = []
    screen_np = cv2.cvtColor(np.array(region_img), cv2.COLOR_RGB2BGR)
    screen_h, screen_w = screen_np.shape[:2]
    for name, tmpl in templates.items():
        if tmpl is None:
            continue
        t_h, t_w = tmpl.shape[:2]
        if t_h > screen_h or t_w > screen_w:
            continue
        res = cv2.matchTemplate(screen_np, tmpl, cv2.TM_CCOEFF_NORMED)
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(res)
        if max_val >= 0.7:
            center_x = max_loc[0] + t_w // 2 + offset_x
            center_y = max_loc[1] + t_h // 2 + offset_y
            matched.append(
                (
                    name,
                    max_val,
                    (center_x, center_y),
                    ((max_loc[0] + offset_x, max_loc[1] + offset_y), (t_w, t_h)),
                )
            )
    return matched


async def get_livesplit_info():
    try:
        current_time = await livesplit_client.get_current_time()
    except Exception:
        current_time = None
    try:
        attempt_count = await livesplit_client.get_attempt_count()
    except Exception:
        attempt_count = None
    return {
        "livesplit_current_time": current_time,
        "livesplit_attempt_count": attempt_count,
    }


def enumerate_runs(data):
    run_id = 1
    prev_time = None
    for entry in data:
        cur_time = entry.get("livesplit_current_time")
        if cur_time is not None:
            try:
                h, m, s = cur_time.split(":")
                s, ms = s.split(".") if "." in s else (s, "0")
                cur_seconds = int(h) * 3600 + int(m) * 60 + float(f"{s}.{ms}")
            except Exception:
                cur_seconds = None
        else:
            cur_seconds = None

        if prev_time is not None and cur_seconds is not None:
            if cur_seconds < prev_time:
                run_id += 1
        entry["run_id"] = run_id
        if cur_seconds is not None:
            prev_time = cur_seconds
    return data


def append_matches_to_json(
    matches,
    screensize,
    livesplit_info=None,
    screenshot_path=None,
    run_id=None,
    detection_uuid=None,
):
    timestamp = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        hours=2
    )
    ts_str = timestamp.strftime("%Y-%m-%d %H:%M:%S")
    entry_list = []
    for name, score, coords, _ in matches:
        marker = None
        image = name
        if "/" in name:
            parts = name.split("/")
            marker = "/".join(parts[:-1])
            image = parts[-1]
        entry = {
            "id": detection_uuid or str(uuid.uuid4()),  # Unique ID for this detection
            "template": name,
            "marker": marker,
            "image": image,
            "percentage": round(score * 100, 2),
            "coordinates": {"x": coords[0], "y": coords[1]},
            "time": ts_str,
            "screensize": {"width": screensize[0], "height": screensize[1]},
        }

        if livesplit_info:
            entry.update(livesplit_info)

        # Add run_id directly (from attempt count)
        if run_id is not None:
            entry["run_id"] = run_id

        # Add screenshot path if provided
        if screenshot_path:
            entry["screenshot_path"] = screenshot_path

        entry_list.append(entry)

    if not entry_list:
        return
    try:
        if os.path.exists(matches_json_path):
            with open(matches_json_path, "r") as f:
                data = json.load(f)
        else:
            data = []
    except Exception:
        data = []
    data.extend(entry_list)
    # No longer need to enumerate runs - using attempt count directly
    with open(matches_json_path, "w") as f:
        json.dump(data, f, indent=2)


def draw_bounding_box_and_text(image_pil, match_info):
    import PIL.ImageDraw as ImageDraw
    import PIL.ImageFont as ImageFont
    from PIL import Image

    name, score, coords, (top_left, (t_w, t_h)) = match_info
    img = image_pil.convert("RGB")
    draw = ImageDraw.Draw(img)
    box_color = (255, 0, 0)
    text_color = (255, 128, 128)
    x1, y1 = top_left
    x2, y2 = x1 + t_w, y1 + t_h
    draw.rectangle([x1, y1, x2, y2], outline=box_color, width=3)
    timestamp = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        hours=2
    )
    ts_str = timestamp.strftime("%Y-%m-%d %H:%M:%S")
    text = f"{coords[0]}, {coords[1]} @ {ts_str}"
    try:
        font = ImageFont.truetype("arial.ttf", 20)
    except Exception:
        font = ImageFont.load_default()
    text_size = draw.textbbox((0, 0), text, font=font)
    text_w = text_size[2] - text_size[0]
    text_h = text_size[3] - text_size[1]
    text_x = x1
    text_y = y2 + 5
    draw.rectangle(
        [text_x, text_y, text_x + text_w, text_y + text_h], fill=(0, 0, 0, 0)
    )
    draw.text((text_x, text_y), text, fill=text_color, font=font)
    return img


last_match_time = 0
current_run_id = 1


def start_status_server(host: str = "127.0.0.1", port: int = 5555):
    class StatusHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path != "/status":
                self.send_response(404)
                self.end_headers()
                return
            try:
                connected = asyncio.run(livesplit_client.is_running())
            except Exception:
                connected = False
            body = json.dumps({"connected": bool(connected)}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, format, *args):
            return

    def serve():
        httpd = HTTPServer((host, port), StatusHandler)
        httpd.serve_forever()

    t = threading.Thread(target=serve, daemon=True)
    t.start()


def get_sanitized_marker_name(template_name):
    """Extract and sanitize marker name for filename."""
    if "/" in template_name:
        parts = template_name.split("/")
        marker = parts[0]  # Get the first part (e.g., 'checkpoint')
    else:
        marker = "unknown"
    # Remove any invalid filename characters
    marker = marker.replace("/", "_").replace("\\", "_").replace(":", "-")
    return marker


def format_livesplit_time_for_filename(livesplit_time_str):
    """Format LiveSplit time string for use in filename."""
    if not livesplit_time_str:
        return "no-time"
    try:
        # Format: "00:00:06.7685969" -> "00-00-06-768"
        time_str = livesplit_time_str.replace(":", "-").split(".")[0]
        if "." in livesplit_time_str:
            ms = livesplit_time_str.split(".")[1][:3]  # First 3 digits of milliseconds
            time_str += f"-{ms}"
        return time_str
    except Exception:
        return "no-time"


# Removed detect_run_change function - now using LiveSplit attempt count as run_id


async def main_loop():
    global last_match_time, current_run_id
    setup_hotkeys()

    try:
        while True:
            shot, screensize = get_full_screenshot()
            results = match_templates(shot)
            now = time.time()

            if results and (now - last_match_time >= 5):
                name, score, coords, extra = results[0]
                log_event(f"Match: {name} at {coords} with {score*100:.2f}%")

                # Generate unique UUID for this detection (prevents collisions)
                detection_uuid = str(uuid.uuid4())

                # Get LiveSplit info - use attempt count as run_id
                livesplit_info = await get_livesplit_info()

                # Use attempt count as run_id (more reliable than time-based detection)
                if livesplit_info and livesplit_info.get("livesplit_attempt_count"):
                    try:
                        run_id = int(livesplit_info.get("livesplit_attempt_count"))
                        current_run_id = run_id  # Update global for consistency
                    except (ValueError, TypeError):
                        run_id = current_run_id
                else:
                    run_id = current_run_id

                # Create run-specific directory
                run_dir = os.path.join(screenshots_dir, f"run_{run_id}")
                os.makedirs(run_dir, exist_ok=True)

                # Generate descriptive filename with UUID to ensure uniqueness
                marker_name = get_sanitized_marker_name(name)
                livesplit_time = format_livesplit_time_for_filename(
                    livesplit_info.get("livesplit_current_time")
                    if livesplit_info
                    else None
                )
                timestamp_ms = int(time.time() * 1000)
                uuid_short = detection_uuid.split("-")[0]  # Use first part of UUID
                filename = f"run_{run_id}_{marker_name}_{livesplit_time}_{timestamp_ms}_{uuid_short}.png"
                filepath = os.path.join(run_dir, filename)

                # Save screenshot with bounding box
                img_with_box = draw_bounding_box_and_text(shot, results[0])
                img_with_box.save(filepath)

                # Update matches JSON with the new filename structure
                append_matches_to_json(
                    [results[0]],
                    screensize,
                    livesplit_info=livesplit_info,
                    screenshot_path=f"run_{run_id}/{filename}",
                    run_id=run_id,  # Pass run_id directly from attempt count
                    detection_uuid=detection_uuid,  # Pass UUID for uniqueness
                )

                last_match_time = now
            await asyncio.sleep(0.5)

    except KeyboardInterrupt:
        if log_buffer:
            with open(log_file, "a") as f:
                f.write("\n".join(log_buffer) + "\n")


if __name__ == "__main__":
    start_status_server()
    asyncio.run(main_loop())
