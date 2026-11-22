"""SSM_Tool — localhost-only proxy QA dashboard using Python, Requests and Playwright."""
from __future__ import annotations

import ipaddress
import os
import json
import re
import secrets
import subprocess
import sys
import threading
import time
import uuid
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, urlsplit

import requests

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / 'data'
PROFILES_DIR = DATA_DIR / 'browser_profiles'
REGISTRY_FILE = DATA_DIR / 'profiles.json'
PROFILES_DIR.mkdir(parents=True, exist_ok=True)
CSRF_TOKEN = secrets.token_urlsafe(32)
STORE: dict[str, dict] = {}
STORE_LOCK = threading.RLock()
BROWSER_PROCESSES: dict[tuple[str, str], subprocess.Popen] = {}
SUPPORTED_SCHEMES = {'http', 'https', 'socks5', 'socks5h'}
MAX_PROXIES = 50
MAX_FIELD = 512


def sanitize_endpoint(raw: str) -> str:
    """Accept host:port or scheme://host:port; credentials must use separate fields."""
    raw = str(raw or '').strip()
    if not raw or len(raw) > MAX_FIELD or any(ch.isspace() for ch in raw):
        raise ValueError('Enter a proxy server such as http://proxy.example:8080')
    if '://' not in raw:
        raw = 'http://' + raw
    parsed = urlsplit(raw)
    try:
        port = parsed.port
    except ValueError as exc:
        raise ValueError('Port must be a number between 1 and 65535') from exc
    if (parsed.scheme not in SUPPORTED_SCHEMES or not parsed.hostname or
            port is None or port < 1 or port > 65535 or parsed.username is not None or
            parsed.password is not None or parsed.path not in ('', '/') or
            parsed.query or parsed.fragment):
        raise ValueError('Use an HTTP(S) or SOCKS5 proxy endpoint with a valid host and port; enter credentials separately')
    hostname = parsed.hostname.lower()
    if ':' in hostname:
        hostname = f'[{hostname}]'
    return f'{parsed.scheme}://{hostname}:{port}'


def proxy_url(item: dict) -> str:
    parsed = urlsplit(item['server'])
    creds = ''
    if item.get('username'):
        creds = quote(item['username'], safe='') + ':' + quote(item.get('password', ''), safe='') + '@'
    return f'{parsed.scheme}://{creds}{parsed.netloc}'


def persist_registry() -> None:
    """Persist names/endpoints only. Never persist proxy credentials."""
    with STORE_LOCK:
        records = [{key: item[key] for key in ('id', 'name', 'server', 'note')}
                   for item in STORE.values()]
    REGISTRY_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary = REGISTRY_FILE.with_suffix('.tmp')
    temporary.write_text(json.dumps(records, indent=2), encoding='utf-8')
    os.replace(temporary, REGISTRY_FILE)


def load_registry() -> None:
    """Load profile metadata. Proxy credentials always require reentry."""
    if not REGISTRY_FILE.is_file():
        return
    try:
        records = json.loads(REGISTRY_FILE.read_text(encoding='utf-8'))
        if not isinstance(records, list):
            return
        with STORE_LOCK:
            for record in records[:MAX_PROXIES]:
                name = str(record.get('name', '')).strip()
                if not name or len(name) > 64:
                    continue
                endpoint = sanitize_endpoint(record.get('server', ''))
                note = str(record.get('note') or '')[:300]
                item_id = str(record.get('id', ''))
                if not re.fullmatch(r'[0-9a-f]{32}', item_id):
                    continue
                STORE[item_id] = dict(id=item_id, name=name, server=endpoint, note=note,
                    username='', password='', status='untested', ip=None,
                    country=None, country_code=None, city=None, region=None,
                    isp=None, latency_ms=None, checked_at=None, error=None,
                    launched=False)
    except (OSError, ValueError, TypeError, AttributeError):
        # A malformed registry never prevents the local dashboard from starting.
        return


def public(item: dict) -> dict:
    fields = ('id', 'name', 'server', 'note', 'status', 'ip', 'country', 'country_code',
              'city', 'region', 'isp', 'latency_ms', 'checked_at', 'error', 'launched')
    return {key: item.get(key) for key in fields}


def add_proxy(data: dict) -> dict:
    name = str(data.get('name') or '').strip()
    server = sanitize_endpoint(data.get('server') or '')
    username = str(data.get('username') or '')
    password = str(data.get('password') or '')
    if not name or len(name) > 64:
        raise ValueError('Profile name is required (maximum 64 characters)')
    if len(username) > MAX_FIELD or len(password) > MAX_FIELD:
        raise ValueError('Credentials are too long')
    with STORE_LOCK:
        if len(STORE) >= MAX_PROXIES:
            raise ValueError('Maximum 50 proxies per session')
        if any(item['name'].casefold() == name.casefold() for item in STORE.values()):
            raise ValueError('That profile name already exists')
        item_id = uuid.uuid4().hex
        item = dict(id=item_id, name=name, server=server, note='', username=username,
                    password=password, status='untested', ip=None, country=None,
                    country_code=None, city=None, region=None, isp=None,
                    latency_ms=None, checked_at=None, error=None, launched=False)
        STORE[item_id] = item
        persist_registry()
        return public(item)


def update_proxy(item_id: str, data: dict) -> dict | None:
    # Updating a proxy resets its prior verification and retains browser profile ID.
    name = str(data.get('name') or '').strip()
    endpoint = sanitize_endpoint(data.get('server') or '')
    username = str(data.get('username') or '')
    password = str(data.get('password') or '')
    if not name or len(name) > 64 or len(username) > MAX_FIELD or len(password) > MAX_FIELD:
        raise ValueError('Invalid proxy details')
    with STORE_LOCK:
        item = STORE.get(item_id)
        if item is None:
            return None
        if any(obj['name'].casefold() == name.casefold() and key != item_id
               for key, obj in STORE.items()):
            raise ValueError('That name is already in use')
        item.update(name=name, server=endpoint, username=username, password=password,
                    status='untested', ip=None, country=None, country_code=None,
                    city=None, region=None, isp=None, latency_ms=None,
                    checked_at=None, error=None)
        persist_registry()
        return public(item)



def set_note(item_id: str, note: str) -> dict | None:
    # Save an optional non-secret comment on a proxy profile.
    if not isinstance(note, str) or len(note) > 300:
        raise ValueError('Comment must be 300 characters or fewer')
    with STORE_LOCK:
        item = STORE.get(item_id)
        if item is None:
            return None
        item['note'] = note.strip()
        persist_registry()
        return public(item)


def lookup_geo(ip: str) -> dict:
    """Country/city database results are approximate, not location proof."""
    ipaddress.ip_address(ip)
    try:
        resp = requests.get(f'https://ipwho.is/{ip}', timeout=8)
        resp.raise_for_status()
        data = resp.json()
        if not data.get('success'):
            return {}
        conn = data.get('connection') or {}
        return {
            'country': data.get('country'), 'country_code': data.get('country_code'),
            'city': data.get('city'), 'region': data.get('region'),
            'isp': conn.get('isp') or conn.get('org')
        }
    except (requests.RequestException, ValueError, KeyError):
        return {}


def inspect_proxy(item: dict) -> dict:
    """Check through the proxy without fallback; never return credentials in errors."""
    start = time.monotonic()
    session = requests.Session()
    session.trust_env = False
    proxy = proxy_url(item)
    session.proxies = {'http': proxy, 'https': proxy}
    try:
        response = session.get('https://api.ipify.org?format=json', timeout=(7, 12))
        response.raise_for_status()
        ip = response.json()['ip']
        ipaddress.ip_address(ip)
        latency_ms = round((time.monotonic() - start) * 1000)
        geo = lookup_geo(ip)
        return dict(status='connected', ip=ip, latency_ms=latency_ms, checked_at=int(time.time()),
                    error=None, **{key: geo.get(key) for key in ('country', 'country_code', 'city', 'region', 'isp')})
    except (requests.RequestException, KeyError, ValueError, TypeError):
        return dict(status='failed', ip=None, latency_ms=None, checked_at=int(time.time()),
                    country=None, country_code=None, city=None, region=None, isp=None,
                    error='Connection failed. Check address, authentication, proxy access and firewall.')
    finally:
        session.close()


def check_proxy(item_id: str) -> dict | None:
    with STORE_LOCK:
        item = STORE.get(item_id)
        if item is None:
            return None
        item['status'] = 'checking'
        copy = item.copy()
    result = inspect_proxy(copy)
    with STORE_LOCK:
        if item_id not in STORE:
            return None
        STORE[item_id].update(result)
        return public(STORE[item_id])


def direct_ip() -> dict:
    session = requests.Session()
    session.trust_env = False
    try:
        response = session.get('https://api.ipify.org?format=json', timeout=8)
        response.raise_for_status()
        ip = response.json()['ip']
        ipaddress.ip_address(ip)
        return {'ip': ip}
    except (requests.RequestException, ValueError, KeyError):
        return {'error': 'Unable to check host IP', 'ip': None}
    finally:
        session.close()


def launch_browser(item_id: str, browser: str = "chromium") -> dict:
    if browser not in ("chromium", "msedge"):
        return {"error": "Unsupported browser type"}
    with STORE_LOCK:
        item = STORE.get(item_id)
        if item is None:
            return {"error": "Profile not found"}
        if item["status"] != "connected":
            return {"error": "First run Test and verify the proxy connects"}
        key = (item_id, browser)
        existing = BROWSER_PROCESSES.get(key)
        if existing is not None and existing.poll() is None:
            return {"error": "This browser is already open. Look for its window in the Windows taskbar."}
        config = {
            "server": item["server"], "username": item["username"],
            "password": item["password"],
            "profile_dir": str(PROFILES_DIR / (item_id if browser == "chromium" else item_id + "_edge_standard")),
            "diagnostics_dir": str(DATA_DIR / "network_diagnostics"),
            "profile_id": item_id, "browser": browser,
            "start_url": "https://www.youtube.com/",
            "expected_ip": item["ip"],
        }
    try:
        process = subprocess.Popen(
            [sys.executable, str(BASE_DIR / "browser_launch.py")],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL, cwd=BASE_DIR,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        process.stdin.write(json.dumps(config).encode("utf-8"))
        process.stdin.close()
        # Never hang an HTTP request indefinitely if Playwright does not start.
        signal = {"value": ""}
        done = threading.Event()

        def receive_start_message():
            try:
                signal["value"] = process.stdout.readline().decode("utf-8", errors="replace").strip()
            except OSError:
                signal["value"] = ""
            done.set()

        threading.Thread(target=receive_start_message, daemon=True).start()
        if not done.wait(55):
            process.terminate()
            return {"error": "Browser startup timed out. Check Edge installation, the proxy connection and network diagnostics."}
        if not signal["value"].startswith("READY:"):
            process.terminate()
            safe_reasons = {
                "ERROR:EDGE_MISSING": "Microsoft Edge is not installed or could not start.",
                "ERROR:PROXY_UNREACHABLE": "Browser could not connect through this proxy. Check its authentication and retest.",
                "ERROR:IP_MISMATCH": "Browser exit IP differs from its assigned proxy. Edge was closed to prevent an incorrect route.",
                "ERROR:BROWSER_START": "Browser could not start. Close other windows and check the installation.",
            }
            return {"error": safe_reasons.get(signal["value"], "Unable to verify the browser's proxy connection. Check diagnostics.")}
        observed_ip = signal["value"].split(":", 1)[1]
        if observed_ip != config["expected_ip"]:
            process.terminate()
            return {"error": "Browser reported an unexpected exit IP; it was closed."}
        with STORE_LOCK:
            BROWSER_PROCESSES[key] = process
        return {"ok": True, "exit_ip": observed_ip,
                "message": ("Edge launched with an isolated profile; proxy precheck passed. Verify its IP in the opened Edge tab."
                            if browser == "msedge" else
                            f"{browser} launched in its own profile; exit IP verified: {observed_ip}")}
    except (OSError, ValueError):
        return {"error": "Unable to start browser process. Run setup_windows.bat first."}


def browser_status() -> dict:
    with STORE_LOCK:
        return {f"{item_id}:{browser}": process.poll() is None
                for (item_id, browser), process in BROWSER_PROCESSES.items()}


def diagnostic_log(item_id: str, browser: str) -> dict:
    if not re.fullmatch(r"[0-9a-f]{32}", item_id) or browser not in ("chromium", "msedge"):
        return {"error": "Invalid diagnostics request"}
    path = DATA_DIR / "network_diagnostics" / f"{item_id}_{browser}.log"
    if not path.exists():
        return {"lines": ["No network log yet. Launch the browser and attempt YouTube first."]}
    return {"lines": path.read_text(encoding="utf-8", errors="replace").splitlines()[-60:]}


class Handler(BaseHTTPRequestHandler):
    server_version = 'SSM_Tool/2.1'

    def log_message(self, fmt, *args):
        # Deliberately avoid request logging (which may contain sensitive data).
        pass

    def send_payload(self, payload: bytes, mimetype: str = 'application/json', status: int = 200):
        self.send_response(status)
        self.send_header('Content-Type', mimetype)
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
        self.end_headers()
        self.wfile.write(payload)

    def json_response(self, data: dict | list, status: int = 200):
        self.send_payload(json.dumps(data).encode('utf-8'), status=status)

    def route_path(self):
        return urlsplit(self.path).path

    def safe_request(self, mutating=False) -> bool:
        host = self.headers.get('Host', '')
        if not (re.fullmatch(r'(127\.0\.0\.1|localhost):\d+', host)):
            self.json_response({'error': 'Local access only'}, 403)
            return False
        if mutating and not secrets.compare_digest(self.headers.get('X-Local-Token', ''), CSRF_TOKEN):
            self.json_response({'error': 'Invalid local session token'}, 403)
            return False
        return True

    def read_json(self) -> dict:
        size = int(self.headers.get('Content-Length', '0'))
        if size <= 0 or size > 20000:
            raise ValueError('Invalid request size')
        data = json.loads(self.rfile.read(size).decode('utf-8'))
        if not isinstance(data, dict):
            raise ValueError('Expected an object')
        return data

    def do_GET(self):
        if not self.safe_request():
            return
        route = self.route_path()
        if route == '/':
            html = (BASE_DIR / 'templates' / 'index.html').read_text(encoding='utf-8')
            html = html.replace('{{ csrf_token }}', CSRF_TOKEN)
            return self.send_payload(html.encode('utf-8'), 'text/html; charset=utf-8')
        if route in ('/static/app.css', '/static/app.js'):
            item = BASE_DIR / route.lstrip('/')
            mimetype = 'text/css; charset=utf-8' if route.endswith('.css') else 'text/javascript; charset=utf-8'
            return self.send_payload(item.read_bytes(), mimetype)
        if route == '/api/browser-status':
            return self.json_response(browser_status())
        match_log = re.fullmatch(r'/api/diagnostics/([0-9a-f]{32})/(chromium|msedge)', route)
        if match_log:
            return self.json_response(diagnostic_log(match_log.group(1), match_log.group(2)))
        if route == '/api/proxies':
            with STORE_LOCK:
                return self.json_response([public(v) for v in STORE.values()])
        if route == '/api/host-ip':
            result = direct_ip()
            return self.json_response(result, 200 if result['ip'] else 503)
        return self.json_response({'error': 'Not found'}, 404)

    def do_POST(self):
        if not self.safe_request(mutating=True):
            return
        route = self.route_path()
        if route == '/api/proxies':
            try:
                added = add_proxy(self.read_json())
                return self.json_response(added, 201)
            except (ValueError, json.JSONDecodeError):
                return self.json_response({'error': 'Invalid proxy details or maximum capacity reached'}, 400)
        match = re.fullmatch(r'/api/proxies/([0-9a-f]{32})/(check|launch)', route)
        if match:
            item_id, action = match.groups()
            if action == 'check':
                result = check_proxy(item_id)
                return self.json_response(result if result else {'error':'Profile not found'}, 200 if result else 404)
            try:
                size = int(self.headers.get('Content-Length', '0'))
                settings = self.read_json() if size else {}
                browser = settings.get('browser', 'chromium')
            except (ValueError, json.JSONDecodeError):
                return self.json_response({'error': 'Invalid browser selection'}, 400)
            result = launch_browser(item_id, browser)
            return self.json_response(result, 202 if result.get('ok') else 400)
        return self.json_response({'error': 'Not found'}, 404)

    def do_PUT(self):
        if not self.safe_request(mutating=True):
            return
        note_match = re.fullmatch(r'/api/proxies/([0-9a-f]{32})/note', self.route_path())
        if note_match:
            try:
                result = set_note(note_match.group(1), self.read_json().get('note', ''))
                return self.json_response(result if result else {'error': 'Profile not found'},
                                          200 if result else 404)
            except (ValueError, json.JSONDecodeError):
                return self.json_response({'error': 'Comment must be 300 characters or fewer'}, 400)
        match = re.fullmatch(r'/api/proxies/([0-9a-f]{32})', self.route_path())
        if not match:
            return self.json_response({'error': 'Not found'}, 404)
        try:
            result = update_proxy(match.group(1), self.read_json())
            return self.json_response(result if result else {'error': 'Profile not found'},
                                      200 if result else 404)
        except (ValueError, json.JSONDecodeError):
            return self.json_response({'error': 'Invalid proxy profile details'}, 400)

    def do_DELETE(self):
        if not self.safe_request(mutating=True):
            return
        note_match = re.fullmatch(r'/api/proxies/([0-9a-f]{32})/note', self.route_path())
        if note_match:
            result = set_note(note_match.group(1), '')
            return self.json_response(result if result else {'error': 'Profile not found'},
                                      200 if result else 404)
        match = re.fullmatch(r'/api/proxies/([0-9a-f]{32})', self.route_path())
        if not match:
            return self.json_response({'error': 'Not found'}, 404)
        with STORE_LOCK:
            if STORE.pop(match.group(1), None) is None:
                return self.json_response({'error': 'Profile not found'}, 404)
            persist_registry()
        return self.json_response({'ok': True})


def make_server(port=8765):
    return ThreadingHTTPServer(('127.0.0.1', port), Handler)


if __name__ == '__main__':
    load_registry()
    server = make_server()
    print('\nSSM_Tool v2.1: http://127.0.0.1:8765')
    print('Proxy credentials remain in memory only; profiles without secrets persist locally.')
    threading.Timer(1.2, lambda: webbrowser.open('http://127.0.0.1:8765')).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
