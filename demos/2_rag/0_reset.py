"""Step 0: delete everything the pipeline built, to start the live demo from scratch."""

import shutil

from common import OUT

shutil.rmtree(OUT, ignore_errors=True)
print(f"Deleted {OUT.name}/. The raw documents in data/ are untouched.")
