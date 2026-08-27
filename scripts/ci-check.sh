#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "[1/3] Backend syntax compile check"
python -m compileall -q backend

echo "[2/3] Backend import smoke check"
python - <<'PY'
import importlib
import pathlib
import sys

root = pathlib.Path("backend")
sys.path.insert(0, str(root.resolve()))

failures = []
for py_file in sorted((root / "app").rglob("*.py")):
    module_name = ".".join(py_file.relative_to(root).with_suffix("").parts)
    try:
        importlib.import_module(module_name)
    except Exception as exc:
        failures.append((module_name, type(exc).__name__, str(exc)))

if failures:
    print(f"Import failures: {len(failures)}")
    for module_name, exc_type, message in failures:
        print(f" - {module_name}: {exc_type}: {message}")
    raise SystemExit(1)

print("All backend modules imported successfully.")
PY

echo "[3/3] Frontend production build"
(
  cd frontend
  npm run build
)

echo "CI checks passed."
