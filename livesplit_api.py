import asyncio
import websockets


async def send_livesplit_command(
    command: str, host: str = "localhost", port: int = 16834, path: str = "/livesplit"
):
    ws_url = f"ws://{host}:{port}{path}"
    async with websockets.connect(ws_url) as ws:
        await ws.send(command)


if __name__ == "__main__":
    # no return
    split = "split"
    reset = "reset"
    start = "starttimer"
    resume= "resume"
    unsplit = "unsplit"

    # returns time
    getcurrenttime = "getcurrenttime"

    # returns int
    attempt_count = "getattemptcount"

    # ping
    ping = "ping"

    
    # asyncio.run(send_livesplit_command("starttimer"))
