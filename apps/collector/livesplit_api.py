import asyncio
import websockets


class LiveSplitClient:
    def __init__(self, host: str = "localhost", port: int = 16834, path: str = "/livesplit"):
        self.host = host
        self.port = port
        self.path = path

    async def _send(self, command: str):
        ws_url = f"ws://{self.host}:{self.port}{self.path}"
        try:
            async with websockets.connect(ws_url) as ws:
                await ws.send(command)
                try:
                    response = await asyncio.wait_for(ws.recv(), timeout=1)
                    return response
                except asyncio.TimeoutError:
                    return None
        except (ConnectionRefusedError, OSError, websockets.exceptions.InvalidURI, websockets.exceptions.InvalidHandshake):
            return None

    async def split(self):
        await self._send("split")

    async def reset(self):
        await self._send("reset")

    async def start(self):
        await self._send("starttimer")

    async def resume(self):
        await self._send("resume")

    async def unsplit(self):
        await self._send("unsplit")

    async def get_current_time(self):
        return await self._send("getcurrenttime")

    async def get_attempt_count(self):
        return await self._send("getattemptcount")

    async def ping(self):
        return await self._send("ping")

    async def is_running(self):
        ws_url = f"ws://{self.host}:{self.port}{self.path}"
        try:
            async with websockets.connect(ws_url) as ws:
                await ws.send("ping")
                await asyncio.wait_for(ws.recv(), timeout=1)
                return True
        except Exception:
            return False


