import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
    
from main import *  # reuse existing logic while preserving paths

if __name__ == "__main__":
    asyncio.run(main_loop())