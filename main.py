import cv2
import numpy as np
import pyautogui
import os
import time
import datetime
import json
from colorama import Fore, Back, Style, init

init(autoreset=True)

checkpoints_dir = "./checkpoints"
screenshots_dir = "./screenshots_cache"
log_file = "log.txt"
matches_json_path = "./data/matches.json"

os.makedirs(checkpoints_dir, exist_ok=True)
os.makedirs(screenshots_dir, exist_ok=True)
os.makedirs(os.path.dirname(matches_json_path), exist_ok=True)

templates = {}
for fname in os.listdir(checkpoints_dir):
    path = os.path.join(checkpoints_dir, fname)
    if fname.lower().endswith((".png", ".jpg", ".jpeg")):
        templates[fname] = cv2.imread(path, cv2.IMREAD_COLOR)

log_buffer = []
last_dump = time.time()


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


def screen_region():
    w, h = pyautogui.size()
    region = (w // 2, 0, w // 2, h // 2)
    return pyautogui.screenshot(region=region), (w, h)


def match_templates(screenshot):
    matched = []
    screen_np = cv2.cvtColor(np.array(screenshot), cv2.COLOR_RGB2BGR)
    for name, tmpl in templates.items():
        if tmpl is None:
            continue
        res = cv2.matchTemplate(screen_np, tmpl, cv2.TM_CCOEFF_NORMED)
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(res)
        if max_val >= 0.7:
            t_h, t_w = tmpl.shape[:2]
            center_x = max_loc[0] + t_w // 2
            center_y = max_loc[1] + t_h // 2
            matched.append((name, max_val, (center_x, center_y), (max_loc, (t_w, t_h))))
    return matched


def append_matches_to_json(matches, screensize):
    timestamp = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        hours=2
    )
    ts_str = timestamp.strftime("%Y-%m-%d %H:%M:%S")
    entry_list = []
    for name, score, coords, _ in matches:
        entry = {
            "template": name,
            "percentage": round(score * 100, 2),
            "coordinates": {"x": coords[0], "y": coords[1]},
            "time": ts_str,
            "screensize": {"width": screensize[0], "height": screensize[1]},
        }
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
    timestamp = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=2)
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
    draw.rectangle([text_x, text_y, text_x + text_w, text_y + text_h], fill=(0,0,0,0))
    draw.text((text_x, text_y), text, fill=text_color, font=font)
    return img

last_match_time = 0

try:
    while True:
        shot, screensize = screen_region()
        fname = f"{screenshots_dir}/{int(time.time()*1000)}.png"

        results = match_templates(shot)
        now = time.time()
        if results and (now - last_match_time >= 5):
            name, score, coords, extra = results[0]
            log_event(f"Match: {name} at {coords} with {score*100:.2f}%")
            img_with_box = draw_bounding_box_and_text(shot, results[0])
            img_with_box.save(fname)
            append_matches_to_json([results[0]], screensize)
            last_match_time = now
        time.sleep(0.5)
        
except KeyboardInterrupt:
    if log_buffer:
        with open(log_file, "a") as f:
            f.write("\n".join(log_buffer) + "\n")
