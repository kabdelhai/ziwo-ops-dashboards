#!/usr/bin/env python3
"""
ziwo_support_dashboard/server.py

Local web server behind the ZIWO Support Dashboard. Enter an instance name
+ password once, then pull Agents, DIDs & Extensions, or Queues as tables
you can filter and download as CSV.

Why a local server instead of calling the ZIWO API straight from the
browser? Because the browser would be subject to CORS — the ZIWO API is
built for server-to-server calls (that's why every other tool in this repo
is a Python CLI script using `requests`), and it may not send the
Access-Control-Allow-Origin headers a browser fetch() needs. This server
makes the exact same requests the proven CLI scripts already make
(same auth call, same endpoints, same fields) from Python, where CORS
doesn't apply, and just hands the JSON to the page:

  - Agents            -> mirrors extract_agents_full.py
  - DIDs & Extensions -> mirrors Extract_DIDs_Script.py / numbers-service.js
  - Queues            -> mirrors extract_queues_full.py
  - Smart Routing     -> mirrors extract_smart_routing.py (list) and
                         remove_smart_routing.py (delete, with the same
                         backup-before-delete safety net)
  - BGW Onboarding    -> runs BGW_Onbording/bgw_discover.sh as a
                         subprocess and streams its stdout live to the
                         browser (chunked HTTP response, one NDJSON line
                         per log line), then reads the CSV it produces.

Usage:
    python3 server.py [port]      # defaults to 8787
    Then open http://localhost:8787 in your browser.

Requires: pip install requests --break-system-packages
"""
import csv
import json
import os
import select
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
ZIWO_ADMIN_EMAIL = os.environ.get("ZIWO_ADMIN_EMAIL", "admin@example.com")

try:
    import requests
except ImportError:
    print("Missing dependency. Run: pip install requests --break-system-packages")
    sys.exit(1)

STATIC_DIR = os.path.dirname(os.path.abspath(__file__))
BACKUPS_DIR = os.path.join(STATIC_DIR, "smart_routing_backups")
BATCH_SIZE = 50
MAX_WORKERS = 5
SR_TIMEOUT = 30
SR_MAX_RETRIES = 3

# BGW_Onbording/ lives two levels up from this file (Scripts/Polished_Scripts/
# ziwo_support_dashboard/ -> Scripts/BGW_Onbording/). Web-triggered runs get
# their own subfolder so they never collide with anything run by hand.
BGW_DIR = os.path.abspath(os.path.join(STATIC_DIR, "..", "..", "BGW_Onbording"))
BGW_DISCOVER_SCRIPT = os.path.join(BGW_DIR, "bgw_discover.sh")
BGW_RUNS_DIR = os.path.join(BGW_DIR, "web_runs")

STATIC_FILES = {
    "/": ("index.html", "text/html"),
    "/index.html": ("index.html", "text/html"),
    "/app.js": ("app.js", "application/javascript"),
    "/styles.css": ("styles.css", "text/css"),
}


# ---------------------------------------------------------------------
# Auth — identical to every other polished script (fixed support login)
# ---------------------------------------------------------------------
def generate_access_token(base_url, password):
    url = f"{base_url}auth/login"
    body = {"username": ZIWO_ADMIN_EMAIL, "password": password, "remember": True}
    resp = requests.post(url, json=body, headers={"Content-Type": "application/json"}, timeout=15)
    resp.raise_for_status()
    return resp.json()["content"]["access_token"]


# ---------------------------------------------------------------------
# Generic paginated fetch, reused for agents / numbers / queues
# ---------------------------------------------------------------------
def get_count(base_url, token, resource, extra_params=None):
    url = f"{base_url}admin/{resource}/count"
    resp = requests.get(url, headers={"access_token": token}, params=extra_params or {}, timeout=10)
    resp.raise_for_status()
    return resp.json().get("content", 0)


def fetch_batch(base_url, token, resource, skip):
    # Note: only the /count endpoints take extra filters (e.g. agents'
    # ?plan=regular) in the proven CLI scripts — the paginated list
    # endpoints are always just limit/skip.
    url = f"{base_url}admin/{resource}/"
    params = {"limit": BATCH_SIZE, "skip": skip}
    resp = requests.get(url, headers={"access_token": token}, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json().get("content", [])


def fetch_all(base_url, token, resource, count):
    all_items = []
    skips = list(range(0, count, BATCH_SIZE))
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {
            executor.submit(fetch_batch, base_url, token, resource, s): s
            for s in skips
        }
        for future in as_completed(futures):
            all_items.extend(future.result())
    return all_items


# ---------------------------------------------------------------------
# Per-object shaping — same fields the equivalent CLI script exports
# ---------------------------------------------------------------------
def shape_agent(record):
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
        "queues": queues,
        "skills": skills,
        "createdAt": record.get("createdAt", ""),
        "updatedAt": record.get("updatedAt", ""),
        "lastLoginAt": record.get("lastLoginAt", ""),
    }


def format_timeslots(timeslots):
    """
    Render the DID's working-hours schedule (the `timeslots` field from
    admin/numbers/, same one WH/Update_DIDs_From_Pattern.py reads/writes)
    as a short human-readable string. Defensive about the exact shape
    since it hasn't been observed live — falls back to raw JSON rather
    than crashing if the day/time keys don't match what's expected.
    """
    if not timeslots:
        return "Not set (24/7 or no schedule)"
    if isinstance(timeslots, str):
        return timeslots
    if isinstance(timeslots, list):
        parts = []
        for slot in timeslots:
            if isinstance(slot, dict):
                day = slot.get("day") or slot.get("weekday") or slot.get("dayOfWeek") or ""
                start = slot.get("from") or slot.get("start") or slot.get("startTime") or slot.get("start_time") or ""
                end = slot.get("to") or slot.get("end") or slot.get("endTime") or slot.get("end_time") or ""
                if day or start or end:
                    parts.append(f"{day} {start}-{end}".strip())
                else:
                    parts.append(json.dumps(slot))
            else:
                parts.append(str(slot))
        return "; ".join(parts) if parts else "Not set"
    return json.dumps(timeslots)


def shape_number(record):
    """DIDs & Extensions — same fields as Extract_DIDs_Script.py, plus the
    working-hours schedule and after-hours routing (timeslots /
    beyondTimeslotsLinkType / beyondTimeslotsLinkData, as read/written by
    WH/Update_DIDs_From_Pattern.py)."""
    link_type = record.get("linkType", "")
    link_data = record.get("linkData", "")
    link_name = link_data
    if link_type in ("ivr", "dialplan"):
        storage = record.get("storage") or {}
        link_name = storage.get("originalName", "") or link_data

    after_hours_type = record.get("beyondTimeslotsLinkType", "")
    after_hours_data = record.get("beyondTimeslotsLinkData", "")

    return {
        "id": record.get("id", ""),
        "did": record.get("did", ""),
        "linkType": link_type,
        "linkName": link_name,
        "workingHours": format_timeslots(record.get("timeslots")),
        "afterHoursType": after_hours_type,
        "afterHoursTarget": after_hours_data,
        "createdAt": record.get("createdAt", ""),
        "updatedAt": record.get("updatedAt", ""),
    }


def shape_queue(record):
    """Same fields as extract_queues_full.py's extract_queue_row."""
    agents = ", ".join(a.get("username", "") for a in record.get("agents", []))
    return {
        "id": record.get("id", ""),
        "name": record.get("name", ""),
        "status": record.get("status", ""),
        "strategyType": record.get("strategyType", ""),
        "extension": record.get("extension", ""),
        "callerIDNumber": record.get("callerIDNumber", ""),
        "language": record.get("language", ""),
        "maxWaitTime": record.get("maxWaitTime", ""),
        "maxQueueSize": record.get("maxQueueSize", ""),
        "wrapUpTime": record.get("wrapUpTime", ""),
        "agents": agents,
        "createdAt": record.get("createdAt", ""),
        "updatedAt": record.get("updatedAt", ""),
    }


# ---------------------------------------------------------------------
# Smart Routing (admin/blacklists/) — list + safe delete.
#
# This resource's /count endpoint has been observed to under-report or
# return 0 even when records exist (see extract_smart_routing.py and
# remove_smart_routing.py), so — unlike agents/numbers/queues above —
# fetching never trusts a precomputed count. It pages in waves of
# MAX_WORKERS batches and stops the moment any page in a wave comes back
# short, which is the same approach both of those proven CLI scripts use.
# ---------------------------------------------------------------------
def fetch_blacklist_batch(base_url, token, skip):
    url = f"{base_url}admin/blacklists/"
    params = {"limit": BATCH_SIZE, "skip": skip}
    headers = {"access_token": token}
    for attempt in range(1, SR_MAX_RETRIES + 1):
        try:
            resp = requests.get(url, headers=headers, params=params, timeout=SR_TIMEOUT)
            resp.raise_for_status()
            return resp.json().get("content", [])
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
            time.sleep(2)
    raise requests.exceptions.RequestException(f"Failed to fetch smart routing batch at skip={skip}")


def fetch_all_smart_routing(base_url, token):
    all_records = []
    skip = 0
    while True:
        wave_skips = [skip + i * BATCH_SIZE for i in range(MAX_WORKERS)]
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            future_to_skip = {
                executor.submit(fetch_blacklist_batch, base_url, token, s): s for s in wave_skips
            }
            results = {future_to_skip[f]: f.result() for f in as_completed(future_to_skip)}

        reached_end = False
        for s in wave_skips:
            batch = results[s]
            all_records.extend(batch)
            if len(batch) < BATCH_SIZE:
                reached_end = True
                break  # don't trust pages after a short/empty one
        if reached_end:
            break
        skip += MAX_WORKERS * BATCH_SIZE
    return all_records


def shape_smart_routing(record):
    """Same fields as extract_smart_routing.py's fetch_batch, plus a
    resolved 'linkedTo' display column."""
    storage = record.get("storage") or {}
    user = record.get("user") or {}
    link_type = record.get("linkType", "")
    link_data = record.get("linkData", "")
    linked_to = link_data
    if link_type in ("ivr", "dialplan"):
        linked_to = storage.get("originalName", "") or link_data
    created_by = " ".join(p for p in [user.get("firstName", ""), user.get("lastName", "")] if p).strip()
    return {
        "id": record.get("id", ""),
        "type": record.get("type", ""),
        "pattern": record.get("pattern", ""),
        "linkType": link_type,
        "linkedTo": linked_to,
        "callerID": record.get("callerID", ""),
        "createdBy": created_by or user.get("username", ""),
    }


def filter_smart_routing(records, mode, target=None):
    """Operates on RAW records (as returned by the API), same as
    remove_smart_routing.py's filter_by_queue — linkType/linkData live at
    the top level of each record, not inside a shaped dict."""
    target_norm = (target or "").strip().lower()

    if mode == "all":
        return list(records)

    if mode == "queue":
        return [
            r for r in records
            if str(r.get("linkType", "")).strip().lower() == "queue"
            and str(r.get("linkData", "")).strip().lower() == target_norm
        ]

    if mode == "ivr":
        matches = [r for r in records if str(r.get("linkType", "")).strip().lower() == "ivr"]
        if not target_norm:
            return matches
        return [
            r for r in matches
            if str(r.get("linkData", "")).strip().lower() == target_norm
            or str((r.get("storage") or {}).get("originalName", "")).strip().lower() == target_norm
        ]

    if mode == "hangup":
        return [r for r in records if str(r.get("linkType", "")).strip().lower() == "hangup"]

    return []


def delete_blacklist_record(base_url, token, record_id):
    url = f"{base_url}admin/blacklists/{record_id}"
    headers = {"access_token": token}
    for attempt in range(1, SR_MAX_RETRIES + 1):
        try:
            resp = requests.delete(url, headers=headers, timeout=SR_TIMEOUT)
            resp.raise_for_status()
            return True, None
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
            time.sleep(2)
        except requests.exceptions.RequestException as e:
            return False, str(e)
    return False, "Max retries exceeded"


def save_smart_routing_backup(records, instance, mode_label):
    """Same JSON shape as remove_smart_routing.py's save_backup — so
    ziwo_dynamic_routing_rollback.py can restore straight from a backup
    this dashboard produced, no format conversion needed."""
    os.makedirs(BACKUPS_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{instance}_smart_routing_removed_{mode_label}_{timestamp}.json"
    path = os.path.join(BACKUPS_DIR, filename)
    backup = {
        "timestamp": str(datetime.now()),
        "client": instance,
        "mode": mode_label,
        "removed_entries": records,
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(backup, f, indent=2)
    return filename, backup


# resource key -> (API resource path, count extra params, shaping fn, sort key fn)
OBJECT_CONFIG = {
    "agents": (
        "agents",
        {"plan": "regular"},
        shape_agent,
        lambda a: (0 if a.get("status") == "active" else 1, a.get("lastName", "") or ""),
    ),
    "numbers": (
        "numbers",
        {},
        shape_number,
        lambda n: n.get("did", "") or "",
    ),
    "queues": (
        "queues",
        {},
        shape_queue,
        lambda q: (0 if q.get("status") == "active" else 1, q.get("name", "") or ""),
    ),
}


def get_all_objects(object_type, instance, password):
    resource, count_params, shape_fn, sort_key = OBJECT_CONFIG[object_type]
    base_url = f"https://{instance}-api.aswat.co/"
    token = generate_access_token(base_url, password)
    count = get_count(base_url, token, resource, count_params)
    if count == 0:
        return []
    items = fetch_all(base_url, token, resource, count)
    items.sort(key=sort_key)
    return [shape_fn(i) for i in items]


# ---------------------------------------------------------------------
# HTTP server
# ---------------------------------------------------------------------
class Handler(BaseHTTPRequestHandler):
    # HTTP/1.1 so chunked Transfer-Encoding (used to stream the BGW
    # discovery log live) is valid; every other response here already
    # sends Content-Length, so this doesn't change their behavior.
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        print(f"[{self.log_date_time_string()}] {fmt % args}")

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _start_chunked(self, content_type):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Transfer-Encoding", "chunked")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()

    def _send_chunk(self, data):
        try:
            self.wfile.write(b"%X\r\n" % len(data) + data + b"\r\n")
            self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _end_chunked(self):
        try:
            self.wfile.write(b"0\r\n\r\n")
            self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass

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

        if self.path.startswith("/api/smart_routing/backups/"):
            filename = os.path.basename(self.path[len("/api/smart_routing/backups/"):])
            fpath = os.path.join(BACKUPS_DIR, filename)
            try:
                with open(fpath, "rb") as f:
                    body = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except FileNotFoundError:
                self._send_json(404, {"ok": False, "error": "Backup file not found"})
            return

        if self.path.startswith("/api/bgw/csv/"):
            filename = os.path.basename(self.path[len("/api/bgw/csv/"):])
            fpath = os.path.join(BGW_RUNS_DIR, filename)
            try:
                with open(fpath, "rb") as f:
                    body = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "text/csv")
                self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except FileNotFoundError:
                self._send_json(404, {"ok": False, "error": "CSV file not found"})
            return

        self._send_json(404, {"ok": False, "error": "Not found"})

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length) or b"{}")

    def _handle_api_errors(self, instance, fn):
        """Run fn() and translate the exceptions every ZIWO call can raise
        into a consistent {ok:false, error} response."""
        try:
            fn()
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

    def do_POST(self):
        if self.path in ("/api/agents", "/api/numbers", "/api/queues"):
            self._handle_object_fetch()
        elif self.path == "/api/smart_routing":
            self._handle_smart_routing_fetch()
        elif self.path == "/api/smart_routing/delete":
            self._handle_smart_routing_delete()
        elif self.path == "/api/bgw/discover":
            self._handle_bgw_discover()
        else:
            self._send_json(404, {"ok": False, "error": "Not found"})

    def _handle_bgw_discover(self):
        """Runs BGW_Onbording/bgw_discover.sh as a subprocess and streams
        its stdout to the browser live, one NDJSON line per line of
        output, as a chunked response. bgw_discover.sh itself appends
        each IP's row to the output CSV as soon as that IP finishes (not
        just at the very end), so this handler polls that CSV file
        while the subprocess is still running and emits a 'row' event
        for every new line it finds — the dashboard table fills in
        live, one IP at a time, instead of waiting for the whole run.
        Ends with a 'done' event carrying the exit code and a summary of
        the final CSV (filename + columns, for the download link)."""
        try:
            data = self._read_json_body()
        except json.JSONDecodeError:
            self._send_json(400, {"ok": False, "error": "Invalid request body"})
            return

        ip_text = (data.get("ips") or "").strip()
        ssh_pass = data.get("sshPass") or ""
        netbox_token = data.get("netboxToken") or ""

        if not ip_text or not ssh_pass or not netbox_token:
            self._send_json(400, {"ok": False, "error": "IP(s), SSH password, and NetBox token are required."})
            return

        if not os.path.isfile(BGW_DISCOVER_SCRIPT):
            self._send_json(404, {"ok": False, "error": f"bgw_discover.sh not found at {BGW_DISCOVER_SCRIPT}"})
            return

        os.makedirs(BGW_RUNS_DIR, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        input_file = os.path.join(BGW_RUNS_DIR, f"web_input_{timestamp}.txt")
        output_csv = os.path.join(BGW_RUNS_DIR, f"web_discover_{timestamp}.csv")

        with open(input_file, "w", encoding="utf-8") as f:
            f.write(ip_text + "\n")

        self._start_chunked("application/x-ndjson")

        def emit(obj):
            self._send_chunk((json.dumps(obj) + "\n").encode("utf-8"))

        csv_columns = []
        rows_sent = 0

        def poll_csv_rows():
            """Reads output_csv (if it exists yet) and emits a 'row'
            event for every data row not already sent. Safe to call
            repeatedly — cheap for a file this size, and re-reading
            from the top each time means we never have to worry about
            a partially-written last line (csv.reader just won't yield
            it as a complete row until the newline lands)."""
            nonlocal csv_columns, rows_sent
            if not os.path.isfile(output_csv):
                return
            try:
                with open(output_csv, newline="", encoding="utf-8") as f:
                    reader = csv.reader(f)
                    all_rows = list(reader)
            except Exception:
                return
            if not all_rows:
                return
            if not csv_columns:
                csv_columns = all_rows[0]
            data_rows = all_rows[1:]
            if len(data_rows) > rows_sent:
                for raw_row in data_rows[rows_sent:]:
                    row_dict = dict(zip(csv_columns, raw_row))
                    emit({"type": "row", "row": row_dict})
                rows_sent = len(data_rows)

        try:
            proc = subprocess.Popen(
                ["bash", BGW_DISCOVER_SCRIPT, input_file, ssh_pass, netbox_token, output_csv],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )
            while True:
                ready, _, _ = select.select([proc.stdout], [], [], 0.3)
                if ready:
                    line = proc.stdout.readline()
                    if line:
                        emit({"type": "log", "line": line.rstrip("\n")})
                    elif proc.poll() is not None:
                        break
                poll_csv_rows()
                if not ready and proc.poll() is not None:
                    break
            proc.stdout.close()
            exit_code = proc.wait()
            poll_csv_rows()  # catch anything written between the last poll and exit
        except Exception as e:
            emit({"type": "error", "error": f"Failed to run bgw_discover.sh: {e}"})
            self._end_chunked()
            return

        csv_payload = None
        if os.path.isfile(output_csv):
            csv_payload = {"filename": os.path.basename(output_csv), "columns": csv_columns, "rowCount": rows_sent}

        emit({"type": "done", "exitCode": exit_code, "csv": csv_payload})
        self._end_chunked()

    def _handle_object_fetch(self):
        object_type = self.path.rsplit("/", 1)[-1]

        try:
            data = self._read_json_body()
        except json.JSONDecodeError:
            self._send_json(400, {"ok": False, "error": "Invalid request body"})
            return

        instance = (data.get("instance") or "").strip()
        password = data.get("password") or ""
        if not instance or not password:
            self._send_json(400, {"ok": False, "error": "Instance name and password are required."})
            return

        def run():
            items = get_all_objects(object_type, instance, password)
            self._send_json(200, {"ok": True, "items": items, "count": len(items)})

        self._handle_api_errors(instance, run)

    def _handle_smart_routing_fetch(self):
        try:
            data = self._read_json_body()
        except json.JSONDecodeError:
            self._send_json(400, {"ok": False, "error": "Invalid request body"})
            return

        instance = (data.get("instance") or "").strip()
        password = data.get("password") or ""
        if not instance or not password:
            self._send_json(400, {"ok": False, "error": "Instance name and password are required."})
            return

        def run():
            base_url = f"https://{instance}-api.aswat.co/"
            token = generate_access_token(base_url, password)
            records = fetch_all_smart_routing(base_url, token)
            records.sort(key=lambda r: str(r.get("pattern", "") or ""))
            items = [shape_smart_routing(r) for r in records]
            self._send_json(200, {"ok": True, "items": items, "count": len(items)})

        self._handle_api_errors(instance, run)

    def _handle_smart_routing_delete(self):
        try:
            data = self._read_json_body()
        except json.JSONDecodeError:
            self._send_json(400, {"ok": False, "error": "Invalid request body"})
            return

        instance = (data.get("instance") or "").strip()
        password = data.get("password") or ""
        mode = (data.get("mode") or "").strip().lower()
        target = data.get("target") or ""
        dry_run = bool(data.get("dryRun"))

        if not instance or not password:
            self._send_json(400, {"ok": False, "error": "Instance name and password are required."})
            return
        if mode not in ("all", "queue", "ivr", "hangup"):
            self._send_json(400, {"ok": False, "error": "Mode must be one of: all, queue, ivr, hangup."})
            return
        if mode == "queue" and not target.strip():
            self._send_json(400, {"ok": False, "error": "A queue name is required for queue mode."})
            return

        def run():
            base_url = f"https://{instance}-api.aswat.co/"
            token = generate_access_token(base_url, password)
            all_records = fetch_all_smart_routing(base_url, token)
            matched = filter_smart_routing(all_records, mode, target)
            mode_label = mode if mode != "queue" else f"queue_{target.strip().replace(' ', '_')}"
            shaped = [shape_smart_routing(r) for r in matched]

            if not matched:
                self._send_json(200, {
                    "ok": True, "dryRun": dry_run, "matchedCount": 0,
                    "deletedCount": 0, "failed": [], "items": [], "backupFile": None,
                })
                return

            if dry_run:
                self._send_json(200, {
                    "ok": True, "dryRun": True, "matchedCount": len(matched),
                    "items": shaped, "backupFile": None,
                })
                return

            # Always back up before touching anything destructive — same
            # shape remove_smart_routing.py writes, so
            # ziwo_dynamic_routing_rollback.py can restore from it.
            backup_filename, _ = save_smart_routing_backup(matched, instance, mode_label)

            deleted = 0
            failed = []
            for r in matched:
                ok, err = delete_blacklist_record(base_url, token, r.get("id"))
                if ok:
                    deleted += 1
                else:
                    failed.append({"id": r.get("id"), "pattern": r.get("pattern"), "error": err})

            self._send_json(200, {
                "ok": True, "dryRun": False, "matchedCount": len(matched),
                "deletedCount": deleted, "failed": failed, "items": shaped,
                "backupFile": backup_filename,
            })

        self._handle_api_errors(instance, run)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
    server = ThreadingHTTPServer(("localhost", port), Handler)
    print(f"ZIWO Support Dashboard running at http://localhost:{port}  (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
