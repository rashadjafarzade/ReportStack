"""Run the ReportStack backend against SQLite + a filesystem stub for MinIO.

Used by the e2e suite when a full Docker stack isn't available (sandboxed CI,
laptops without Docker, etc.). NOT a production runner.

Usage:
    python tests/e2e/scripts/run-backend-sandbox.py

Env vars (optional):
    RS_SANDBOX_DB     SQLite path (default: tests/e2e/.sandbox/db.sqlite)
    RS_SANDBOX_FILES  Local filesystem dir for "MinIO" objects
                      (default: tests/e2e/.sandbox/files)
    RS_SANDBOX_HOST   Bind host (default 127.0.0.1)
    RS_SANDBOX_PORT   Bind port (default 8000)
"""
import os
import sys
import pathlib

# Resolve sandbox dirs.
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent.parent  # repo root
SANDBOX = HERE.parent / ".sandbox"
SANDBOX.mkdir(exist_ok=True)
DB_PATH = pathlib.Path(os.getenv("RS_SANDBOX_DB", SANDBOX / "db.sqlite"))
FILES_DIR = pathlib.Path(os.getenv("RS_SANDBOX_FILES", SANDBOX / "files"))
FILES_DIR.mkdir(exist_ok=True, parents=True)

# Wire env vars before importing app modules.
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH}"
# Steer Ollama toward an unreachable URL — the analyzer falls back to
# TO_INVESTIGATE on connection error, which is what we test.
os.environ.setdefault("OLLAMA_BASE_URL", "http://127.0.0.1:1")
os.environ.setdefault("MINIO_ENDPOINT", "127.0.0.1:9999")  # unreachable; we'll stub
os.environ.setdefault("JWT_SECRET", "sandbox-secret-not-for-production")

# Wipe proxy env vars — httpx tries to use SOCKS proxies if HTTP_PROXY/ALL_PROXY
# point at one, and crashes when the optional `socksio` package isn't installed.
# Tests don't need a proxy to reach 127.0.0.1.
for v in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY",
          "http_proxy", "https_proxy", "all_proxy"):
    os.environ.pop(v, None)

# Make the backend importable.
sys.path.insert(0, str(ROOT / "backend"))

# Monkey-patch storage to use local filesystem.
from app.services import storage as _storage  # noqa: E402

def _key_to_path(object_key: str) -> pathlib.Path:
    safe = object_key.replace("..", "_")
    return FILES_DIR / safe

def _ensure_bucket():
    pass  # no-op; FILES_DIR exists already

def _upload_file(object_key: str, data: bytes, content_type: str) -> None:
    p = _key_to_path(object_key)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(data)
    p.with_suffix(p.suffix + ".ct").write_text(content_type or "application/octet-stream")

def _download_file(object_key: str):
    p = _key_to_path(object_key)
    if not p.exists():
        raise FileNotFoundError(object_key)
    ct_path = p.with_suffix(p.suffix + ".ct")
    ct = ct_path.read_text() if ct_path.exists() else "application/octet-stream"
    return p.read_bytes(), ct

def _delete_file(object_key: str) -> None:
    p = _key_to_path(object_key)
    if p.exists():
        p.unlink()
    ct = p.with_suffix(p.suffix + ".ct")
    if ct.exists():
        ct.unlink()

_storage.ensure_bucket = _ensure_bucket
_storage.upload_file = _upload_file
_storage.download_file = _download_file
_storage.delete_file = _delete_file

# Re-bind in modules that imported by-name before the patch.
for modname in ("app.api.attachments", "app.services.retention"):
    try:
        import importlib
        mod = importlib.import_module(modname)
        if hasattr(mod, "upload_file"):
            mod.upload_file = _upload_file
        if hasattr(mod, "download_file"):
            mod.download_file = _download_file
        if hasattr(mod, "delete_file"):
            mod.delete_file = _delete_file
    except Exception as e:  # pragma: no cover
        print(f"warn: could not rebind {modname}: {e}")


# Import app AFTER patches.
from app.main import app  # noqa: E402,F401

if __name__ == "__main__":
    import uvicorn

    host = os.getenv("RS_SANDBOX_HOST", "127.0.0.1")
    port = int(os.getenv("RS_SANDBOX_PORT", "8000"))
    print(f"[sandbox] DATABASE_URL={os.environ['DATABASE_URL']}")
    print(f"[sandbox] FILES_DIR={FILES_DIR}")
    print(f"[sandbox] starting uvicorn on http://{host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level="warning")
