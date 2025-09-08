import cv2
import numpy as np
import pyautogui
import os
import time
import datetime
from colorama import Fore, Style, init

init(autoreset=True)

checkpoints_dir = "./checkpoints"
screenshots_dir = "./screenshots_cache"
log_file = "log.txt"

os.makedirs(checkpoints_dir, exist_ok=True)
os.makedirs(screenshots_dir, exist_ok=True)

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
    print(Fore.GREEN + entry + Style.RESET_ALL)

    if time.time() - last_dump >= 5:
        with open(log_file, "a") as f:
            f.write("\n".join(log_buffer) + "\n")
        log_buffer = []
        last_dump = time.time()


def screen_region():
    w, h = pyautogui.size()
    region = (w // 2, 0, w // 2, h // 2)  # top-right from mid X,Y to top-right corner
    return pyautogui.screenshot(region=region)


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
            matched.append((name, max_val, (center_x, center_y)))
    return matched


try:
    while True:
        shot = screen_region()
        fname = f"{screenshots_dir}/{int(time.time()*1000)}.png"
        shot.save(fname)

        results = match_templates(shot)
        for name, score, coords in results:
            log_event(f"Match: {name} at {coords} with {score*100:.2f}%")

        time.sleep(0.5)

except KeyboardInterrupt:
    if log_buffer:
        with open(log_file, "a") as f:
            f.write("\n".join(log_buffer) + "\n")
