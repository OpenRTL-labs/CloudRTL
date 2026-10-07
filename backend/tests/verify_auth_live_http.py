import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from sqlalchemy import text

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.database import engine, SessionLocal
from app.models import User

BASE_URL = "http://127.0.0.1:8001"

def http_req(path, method="GET", data=None, headers=None):
    url = f"{BASE_URL}{path}"
    headers = headers or {}
    req_data = None
    if data is not None:
        req_data = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = {"detail": body}
        return err.code, parsed

def main():
    print("=== STARTING FASTAPI LIVE HTTP AUTHENTICATION TESTS ===")

    # Clean up test user in DB
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM users WHERE username IN ('liveuser1', 'liveuser2')"))
        conn.commit()

    python_exe = sys.executable
    server_process = subprocess.Popen(
        [python_exe, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8001"],
        cwd=os.path.abspath(os.path.join(os.path.dirname(__file__), "..")),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    try:
        # Wait for server to start
        time.sleep(2)
        for _ in range(10):
            try:
                code, resp = http_req("/health")
                if code == 200:
                    break
            except Exception:
                time.sleep(1)

        print("[1] Testing /health...")
        code, resp = http_req("/health")
        assert code == 200 and resp.get("status") == "healthy", f"Failed health check: {code}, {resp}"
        print("    -> [PASS] /health works: HTTP 200 healthy")

        print("[2] Testing /db-health...")
        code, resp = http_req("/db-health")
        assert code == 200 and resp.get("status") == "database connected", f"Failed db-health check: {code}, {resp}"
        print("    -> [PASS] /db-health works: HTTP 200 database connected")

        print("[3] Testing existing /projects endpoint...")
        code, resp = http_req("/projects")
        assert code == 200 and "projects" in resp, f"Failed projects check: {code}, {resp}"
        assert any(p["name"] == "counter" for p in resp["projects"]), "Counter project missing!"
        print("    -> [PASS] Existing /projects endpoint intact: HTTP 200 with counter project")

        print("[4] Testing POST /auth/register...")
        reg_payload = {
            "username": "liveuser1",
            "password": "LivePassword123!",
            "email": "liveuser1@cloudrtl.test"
        }
        code, resp = http_req("/auth/register", method="POST", data=reg_payload)
        assert code == 201, f"Expected 201, got {code}: {resp}"
        assert resp["username"] == "liveuser1"
        assert resp["email"] == "liveuser1@cloudrtl.test"
        assert "password_hash" not in resp, "CRITICAL: password_hash exposed in registration response!"
        assert "id" in resp and "created_at" in resp
        print("    -> [PASS] Registration succeeded: HTTP 201, returned safe fields, password_hash not exposed")

        print("[5] Verifying PostgreSQL database row directly...")
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT id, username, email, password_hash, created_at FROM users WHERE username = 'liveuser1'")
            ).fetchone()
            assert row is not None, "User row not found in PostgreSQL!"
            assert row.username == "liveuser1"
            assert row.password_hash != "LivePassword123!", "CRITICAL: Plaintext password stored in DB!"
            assert row.password_hash.startswith("$argon2id$"), f"Unexpected hash format: {row.password_hash}"
            print(f"    -> [PASS] Stored in PostgreSQL: id={row.id}, hash prefix={row.password_hash[:20]}... (Argon2)")

        print("[6] Testing duplicate username rejection...")
        code, resp = http_req("/auth/register", method="POST", data=reg_payload)
        assert code == 400, f"Expected 400, got {code}: {resp}"
        assert "Username is already registered" in resp.get("detail", "")
        print(f"    -> [PASS] Duplicate username rejected: HTTP {code} {resp.get('detail')}")

        print("[7] Testing duplicate email rejection...")
        code, resp = http_req("/auth/register", method="POST", data={
            "username": "liveuser2",
            "password": "Password456!",
            "email": "liveuser1@cloudrtl.test"
        })
        assert code == 400, f"Expected 400, got {code}: {resp}"
        assert "Email is already registered" in resp.get("detail", "")
        print(f"    -> [PASS] Duplicate email rejected: HTTP {code} {resp.get('detail')}")

        print("[8] Testing POST /auth/login with valid credentials...")
        code, resp = http_req("/auth/login", method="POST", data={
            "username": "liveuser1",
            "password": "LivePassword123!"
        })
        assert code == 200, f"Expected 200, got {code}: {resp}"
        assert "access_token" in resp and resp["token_type"] == "bearer"
        assert "password_hash" not in resp
        access_token = resp["access_token"]
        print("    -> [PASS] Login succeeded: HTTP 200, returned JWT access token")

        print("[9] Testing POST /auth/login with invalid password...")
        code, resp = http_req("/auth/login", method="POST", data={
            "username": "liveuser1",
            "password": "WrongPassword!"
        })
        assert code == 401, f"Expected 401, got {code}: {resp}"
        print(f"    -> [PASS] Invalid password rejected: HTTP {code} {resp.get('detail')}")

        print("[10] Testing POST /auth/login with nonexistent user...")
        code, resp = http_req("/auth/login", method="POST", data={
            "username": "nonexistent",
            "password": "LivePassword123!"
        })
        assert code == 401, f"Expected 401, got {code}: {resp}"
        print(f"    -> [PASS] Nonexistent user rejected: HTTP {code} {resp.get('detail')}")

        print("[11] Testing GET /auth/me with valid JWT...")
        code, resp = http_req("/auth/me", headers={"Authorization": f"Bearer {access_token}"})
        assert code == 200, f"Expected 200, got {code}: {resp}"
        assert resp["username"] == "liveuser1"
        assert resp["email"] == "liveuser1@cloudrtl.test"
        assert "password_hash" not in resp, "CRITICAL: password_hash exposed in /auth/me!"
        assert "id" in resp and "created_at" in resp
        print("    -> [PASS] /auth/me succeeded: HTTP 200 with authenticated user info (id, username, email, created_at)")

        print("[12] Testing GET /auth/me without Authorization header...")
        code, resp = http_req("/auth/me")
        assert code == 401, f"Expected 401, got {code}: {resp}"
        print(f"    -> [PASS] Missing token rejected: HTTP {code} {resp.get('detail')}")

        print("[13] Testing GET /auth/me with invalid/corrupt token...")
        code, resp = http_req("/auth/me", headers={"Authorization": "Bearer bad.token.here"})
        assert code == 401, f"Expected 401, got {code}: {resp}"
        print(f"    -> [PASS] Invalid token rejected: HTTP {code} {resp.get('detail')}")

        print("[14] Verifying project files endpoint still intact...")
        code, resp = http_req("/projects/counter/files")
        assert code == 200 and "files" in resp, f"Failed counter files check: {code}: {resp}"
        print("    -> [PASS] /projects/counter/files works: HTTP 200")

    finally:
        server_process.terminate()
        server_process.wait()
        # Clean up database
        with engine.connect() as conn:
            conn.execute(text("DELETE FROM users WHERE username IN ('liveuser1', 'liveuser2')"))
            conn.commit()

    print("=== ALL 14 LIVE HTTP TESTS PASSED PERFECTLY! ===")

if __name__ == "__main__":
    main()
