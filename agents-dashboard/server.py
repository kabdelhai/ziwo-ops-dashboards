#!/usr/bin/env python3
"""
agents_dashboard/server.py

Tiny local web server that powers the Agents dashboard (index.html + app.js).
Enter an instance name + password in the browser, click "Get Agents", and
see the full agent list rendered as a table with a CSV download button.

Why a local server instead of calling the ZIWO API straight from the
browser? Because the browser would be subject to CORS — the ZIWO API is
built for server-to-server calls (that's why every other tool in this repo
is a Python CLI script using `requests`), and it may not send the
Access-Control-Allow-Origin headers a browser fetch() needs. This server
makes the exact same request extract_agents_full.py already makes
(same auth call, same /admin/agents/ endpoint, same fields) from Python,
where CORS doesn't apply, and just hands the JSON to the page.

Usage:
    python3 server.py [port]      # defaults to 8787
    Then open http://localhost:8787 in your browser.

Requires: pip install requests --break-system-packages
"""
import json
import os
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
ZIWO_ADMIN_EMAIL = os.environ.get("ZIWO_ADMIN_EMAIL", "admin@example.com")

try:
    import requests
except ImportError:
    print("Missing dependency. Run: pip install requests --break-system-packages")
    sys.exit(1)

STATIC_DIR = os.path.dirname(os.path.abspath(__file__))
BATCH_SIZE = 50
MAX_WORKERS = 5
lock = threading.Lock()

STATIC_FILES = {
    "/": ("index.html", "text/html"),
    "/index.html": ("index.html", "text/html"),
    "/app.js": ("app.js", "application/javascript"),
    "/styles.css": ("styles.css", "text/css"),
}


# ---------------------------------------------------------------------
# Same logic as extract_agents_full.py — auth, count, paginated fetch,
# row shaping. Kept 1:1 so this dashboard and the CLI script never drift.
# ---------------------------------------------------------------------
def generate_access_token(base_url, password):
    url = f"{base_url}auth/login"
    body = {"username": ZIWO_ADMIN_EMAIL, "password": password, "remember": True}
    resp = requests.post(url, json=body, headers={"Content-Type": "application/json"}, timeout=15)
    resp.raise_for_status()
    return resp.json()["content"]["access_token"]


def get_agents_count(base_url, token):
    url = f"{base_url}admin/agents/count?plan=regular"
    resp = requests.get(url, headers={"access_token": token}, timeout=10)
    resp.raise_for_status()
    return resp.json().get("content", 0)


def fetch_agents_batch(base_url, token, skip):
    url = f"{base_url}admin/agents/"
    params = {"limit": BATCH_SIZE, "skip": skip}
    resp = requests.get(url, headers={"access_token": token}, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json().get("content", [])


def fetch_all_agents(base_url, token, count):
    all_agents = []
    skips = list(range(0, count, BATCH_SIZE))
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(fetch_agents_batch, base_url, token, s): s for s in skips}
        for future in as_completed(futures):
            all_agents.extend(future.result())
    return all_agents


def shape_agent(record):
    """Same fields as extract_agents_full.py's HEADER/extract_agent_row, as a dict."""
    queues = ", ".join(q.get("name", "") for q in record.get("queues", []))
    skills = ", ".join(s.get("name", "") for s in record.get("skills", []))
    roles = ", ".join(record.get("roles", []))
    return {
        "id": record.get("id", ""),
        "ccLogin": record.get("ccLogin", ""),
        "firstName": record.get("firstName", ""),
        "lastName": record.get("lastName", ""),
        "username": record.get("username", ""),
        "status": record.get("status", ""),
        "plan": record.get("plan", ""),
        "type": record.get("type", ""),
        "roles": roles,
        "autoAnswer": record.get("autoAnswer", ""),
        "noAnswerTimeout": record.get("noAnswerTimeout", ""),
        "wrapUpTime": record.get("wrapUpTime", ""),
        "pauseRecording": record.get("pauseRecording", ""),
        "roamingContactNumber": record.get("roamingContactNumber", ""),
        "contactNumber": record.get("contactNumber", ""),
        "queues": queues,
        "skills": skills,
        "createdAt": record.get("createdAt", ""),
        "updatedAt": record.get("updatedAt", ""),
        "lastLoginAt": record.get("lastLoginAt", ""),
    }


def get_all_agents(instance, password):
    base_url = f"https://{instance}-api.aswat.co/"
    token = generate_access_token(base_url, password)
    count = get_agents_count(base_url, token)
    if count == 0:
        return []
    agents = fetch_all_agents(base_url, token, count)
    agents.sort(key=lambda a: (0 if a.get("status") == "active" else 1, a.get("lastName", "") or ""))
    return [shape_agent(a) for a in agents]


# ---------------------------------------------------------------------
# HTTP server
# ---------------------------------------------------------------------
class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[{self.log_date_time_string()}] {fmt % args}")

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path in STATIC_FILES:
            fname, ctype = STATIC_FILES[self.path]
            fpath = os.path.join(STATIC_DIR, fname)
            try:
                with open(fpath, "rb") as f:
                    body = f.read()
                self.send_response(200)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except FileNotFoundError:
                self._send_json(404, {"ok": False, "error": f"{fname} not found"})
            return
        self._send_json(404, {"ok": False, "error": "Not found"})

    def do_POST(self):
        if self.path != "/api/agents":
            self._send_json(404, {"ok": False, "error": "Not found"})
            return

        length = int(self.headers.get("Content-Length", 0))
        try:
            data = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            self._send_json(400, {"ok": False, "error": "Invalid request body"})
            return

        instance = (data.get("instance") or "").strip()
        password = data.get("password") or ""

        if not instance or not password:
            self._send_json(400, {"ok": False, "error": "Instance name and password are required."})
            return

        try:
            agents = get_all_agents(instance, password)
            self._send_json(200, {"ok": True, "agents": agents, "count": len(agents)})
        except requests.exceptions.HTTPError as e:
            status = e.response.status_code if e.response is not None else 502
            if status in (401, 403):
                msg = "Authentication failed — check the instance name and password."
            else:
                msg = f"ZIWO API returned an error (HTTP {status})."
            self._send_json(200, {"ok": False, "error": msg})
        except requests.exceptions.RequestException as e:
            print(f"Connection error for instance '{instance}': {e}")
            self._send_json(200, {"ok": False, "error": f"Could not reach {instance}-api.aswat.co. Check the instance name and your network connection."})
        except KeyError:
            self._send_json(200, {"ok": False, "error": "Unexpected response from ZIWO API (no access token). Check the instance name."})
        except Exception as e:
            self._send_json(500, {"ok": False, "error": f"Unexpected error: {e}"})


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
    server = ThreadingHTTPServer(("localhost", port), Handler)
    print(f"Agents dashboard running at http://localhost:{port}  (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
