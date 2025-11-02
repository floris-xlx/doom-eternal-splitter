#!/usr/bin/env python3
"""
Tiny PyQt5 overlay that records WASD, Space and mouse up/down to an SQLite DB.
Dependencies: PyQt5, keyboard, mouse
Install: pip install PyQt5 keyboard mouse

Run: python3 pyqt_overlay_keystroke_recorder.py

Notes:
- keyboard and mouse libraries require appropriate permissions on some OSes.
- On Linux, run as root or give uinput permissions for global hooks.
"""
import sys
import sqlite3
import threading
import time
from datetime import datetime

import keyboard
import mouse
from PyQt5 import QtWidgets, QtCore, QtGui

DB_PATH = "keystrokes.db"
TRACKED_KEYS = {"w", "a", "s", "d", "space"}


class EventDB:
    def __init__(self, path=DB_PATH):
        self.path = path
        self.conn = sqlite3.connect(self.path, check_same_thread=False)
        self.lock = threading.Lock()
        self._ensure_table()

    def _ensure_table(self):
        with self.lock:
            cur = self.conn.cursor()
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ts TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    code TEXT,
                    action TEXT,
                    x INTEGER,
                    y INTEGER
                )
                """
            )
            self.conn.commit()

    def insert(self, event_type, code=None, action=None, x=None, y=None):
        ts = datetime.utcnow().isoformat() + "Z"
        with self.lock:
            cur = self.conn.cursor()
            cur.execute(
                "INSERT INTO events (ts, event_type, code, action, x, y) VALUES (?, ?, ?, ?, ?, ?)",
                (ts, event_type, code, action, x, y),
            )
            self.conn.commit()

    def close(self):
        try:
            self.conn.close()
        except Exception:
            pass


class Overlay(QtWidgets.QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowFlags(
            QtCore.Qt.FramelessWindowHint
            | QtCore.Qt.WindowStaysOnTopHint
            | QtCore.Qt.Tool
        )
        # Transparent background
        self.setAttribute(QtCore.Qt.WA_TranslucentBackground)
        # Small always-on-top widget, click-through optional (platform dependent)
        self.resize(200, 60)
        self.move(20, 20)

        self.label = QtWidgets.QLabel("", self)
        self.label.setAlignment(QtCore.Qt.AlignCenter)
        font = QtGui.QFont("Consolas", 20, QtGui.QFont.Bold)
        self.label.setFont(font)
        self.label.setStyleSheet(
            "QLabel{background:rgba(0,0,0,140); color: white; border-radius:8px; padding:8px;}"
        )
        self.label.setGeometry(0, 0, 200, 60)

        # Fade timer
        self._fade_timer = QtCore.QTimer()
        self._fade_timer.setInterval(1200)  # ms
        self._fade_timer.timeout.connect(self.clear_label)

    def show_hit(self, text: str):
        self.label.setText(text)
        self._fade_timer.start()

    def clear_label(self):
        self._fade_timer.stop()
        self.label.setText("")

    # Optional: allow dragging overlay by mouse
    def mousePressEvent(self, event):
        if event.button() == QtCore.Qt.LeftButton:
            self._drag_pos = event.globalPos() - self.frameGeometry().topLeft()
            event.accept()

    def mouseMoveEvent(self, event):
        if hasattr(self, "_drag_pos"):
            self.move(event.globalPos() - self._drag_pos)
            event.accept()


class Recorder:
    def __init__(self, db: EventDB, overlay: Overlay):
        self.db = db
        self.overlay = overlay
        self.running = False
        self._threads = []

    def start(self):
        self.running = True
        # Keyboard listeners
        t1 = threading.Thread(target=self._keyboard_worker, daemon=True)
        t1.start()
        self._threads.append(t1)
        # Mouse listeners
        t2 = threading.Thread(target=self._mouse_worker, daemon=True)
        t2.start()
        self._threads.append(t2)

    def stop(self):
        self.running = False
        try:
            keyboard.unhook_all()
        except Exception:
            pass
        try:
            mouse.unhook_all()
        except Exception:
            pass

    def _keyboard_worker(self):
        # Register press and release callbacks for tracked keys
        for key in TRACKED_KEYS:
            # Map 'space' to the keyboard library name
            name = key
            keyboard.on_press_key(name, lambda e, k=key: self._on_key(e, k, "down"))
            keyboard.on_release_key(name, lambda e, k=key: self._on_key(e, k, "up"))

        # Keep thread alive while running
        while self.running:
            time.sleep(0.2)

    def _on_key(self, event, key, action):
        # event.scan_code and name available
        code = key
        self.db.insert("keyboard", code=code, action=action)
        # Update overlay. Use main thread via Qt signal invocation
        text = f"{key.upper()} {action.upper()}"
        QtCore.QMetaObject.invokeMethod(
            self.overlay,
            "show_hit",
            QtCore.Qt.QueuedConnection,
            QtCore.Q_ARG(str, text),
        )

    def _mouse_worker(self):
        # mouse library sends events for all buttons
        def on_mouse(event):
            try:
                if isinstance(event, mouse.ButtonEvent):
                    button = event.button  # e.g. 'left'
                    action = "down" if event.event_type == "down" else "up"
                    x, y = event.x, event.y
                    self.db.insert("mouse", code=button, action=action, x=x, y=y)
                    text = f"MOUSE {button.upper()} {action.upper()}"
                    QtCore.QMetaObject.invokeMethod(
                        self.overlay,
                        "show_hit",
                        QtCore.Qt.QueuedConnection,
                        QtCore.Q_ARG(str, text),
                    )
            except Exception:
                pass

        mouse.hook(on_mouse)
        # Keep thread alive while running
        while self.running:
            time.sleep(0.2)


# --- Main Application ---
def main():
    app = QtWidgets.QApplication(sys.argv)
    overlay = Overlay()
    overlay.show()

    db = EventDB()
    recorder = Recorder(db, overlay)
    recorder.start()

    # Clean shutdown when Qt app exits
    def on_exit():
        recorder.stop()
        db.close()

    app.aboutToQuit.connect(on_exit)

    try:
        sys.exit(app.exec_())
    except KeyboardInterrupt:
        on_exit()


if __name__ == "__main__":
    main()
