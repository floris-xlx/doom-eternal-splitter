import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
    
from main import *  

if __name__ == "__main__":
    start_status_server()
    asyncio.run(main_loop())