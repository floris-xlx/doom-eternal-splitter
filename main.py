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

init(autoreset=True)

markers_root = "./markers"
screenshots_dir = "./screenshots_cache"
log_file = "log.txt"
matches_json_path = "./data/matches.json"

os.makedirs(markers_root, exist_ok=True)
os.makedirs(screenshots_dir, exist_ok=True)
os.makedirs(os.path.dirname(matches_json_path), exist_ok=True)

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

from livesplit_api import LiveSplitClient

livesplit_client = LiveSplitClient()


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
    for name, tmpl in templates.items():
        if tmpl is None:
            continue
        res = cv2.matchTemplate(screen_np, tmpl, cv2.TM_CCOEFF_NORMED)
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(res)
        if max_val >= 0.7:
            t_h, t_w = tmpl.shape[:2]
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
                # Parse as timedelta, e.g. "00:01:57.3362060"
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


def append_matches_to_json(matches, screensize, livesplit_info=None):
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
    data = enumerate_runs(data)
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

async def main_loop():
    global last_match_time
    try:
        while True:
            shot, screensize = get_full_screenshot()
            fname = f"{screenshots_dir}/{int(time.time()*1000)}.png"
            results = match_templates(shot)
            now = time.time()
            if results and (now - last_match_time >= 5):
                name, score, coords, extra = results[0]
                log_event(f"Match: {name} at {coords} with {score*100:.2f}%")
                img_with_box = draw_bounding_box_and_text(shot, results[0])
                img_with_box.save(fname)
                livesplit_info = await get_livesplit_info()
                append_matches_to_json([results[0]], screensize, livesplit_info)
                last_match_time = now
            await asyncio.sleep(0.5)

    except KeyboardInterrupt:
        if log_buffer:
            with open(log_file, "a") as f:
                f.write("\n".join(log_buffer) + "\n")


if __name__ == "__main__":
    asyncio.run(main_loop())
