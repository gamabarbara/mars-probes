import os
from pathlib import Path

from api.application import create_app

app = create_app(Path(os.environ.get("DATABASE_PATH", "probes.sqlite3")))
