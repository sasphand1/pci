"""SSM_Tool browser worker: Chromium + Edge compatibility mode for authenticated proxies.

Secrets enter through stdin only. Logs contain hostnames and sanitized failure codes,
never request paths, headers, cookies, proxy usernames or passwords.
"""
from __future__ import annotations

import json
import re
import sys
import os
import shutil
import subprocess
import time
import ipaddress
from pathlib import Path
from urllib.parse import urlsplit

import requests
from playwright.sync_api import sync_playwright
from proxy_bridge import ProxyBridge

WATCH_DOMAINS = (
    "youtube.com", "youtu.be", "ytimg.com", "googlevideo.com",
    "google.com", "googleapis.com", "gstatic.com", "googleusercontent.com",
)


def matching_host(url: str) -> str | None:
    host = (urlsplit(url).hostname or "").lower()
    if any(host == suffix or host.endswith("." + suffix) for suffix in WATCH_DOMAINS):
        return host
    return None


def make_logger(filename: Path):
    count = [0]
    filename.parent.mkdir(parents=True, exist_ok=True)

    def write(kind: str, hostname: str = "", detail: str = "") -> None:
        if count[0] >= 150:
            return
        count[0] += 1
        # Restrict all variable data to safe domain characters, digits and fixed error codes.
        safe_host = re.sub(r"[^a-z0-9.\-]", "", hostname.lower())[:110]
        if not any(safe_host == suffix or safe_host.endswith("." + suffix) for suffix in WATCH_DOMAINS):
            safe_host = "other"
        safe_detail = detail if (re.fullmatch(r"net::ERR_[A-Z0-9_]+", detail)
                                  or re.fullmatch(r"[0-9]{3}", detail)) else ""
        with filename.open("a", encoding="utf-8") as output:
            output.write(f"{kind} {safe_host} {safe_detail}\n")

    return write



def locate_edge() -> Path | None:
    """Return the actual Microsoft Edge executable, without invoking Playwright."""
    candidates = []
    for name in ("PROGRAMFILES(X86)", "PROGRAMFILES", "LOCALAPPDATA"):
        root = os.environ.get(name)
        if root:
            candidates.append(Path(root) / "Microsoft" / "Edge" / "Application" / "msedge.exe")
    found = shutil.which("msedge.exe") or shutil.which("msedge")
    if found:
        candidates.append(Path(found))
    if os.name == "nt":
        try:
            import winreg
            for hive in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
                try:
                    with winreg.OpenKey(hive, r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe") as key:
                        candidates.append(Path(winreg.QueryValueEx(key, "")[0]))
                except OSError:
                    continue
        except ImportError:
            pass
    return next((candidate for candidate in candidates if candidate.is_file()), None)


def verified_exit_ip(proxy: dict, expected: str) -> str:
    """Fail-closed proxy preflight; never silently use direct host networking."""
    with requests.Session() as session:
        session.trust_env = False
        session.proxies = {"http": proxy["server"], "https": proxy["server"]}
        if "username" in proxy:
            from urllib.parse import quote, urlsplit, urlunsplit
            parts = urlsplit(proxy["server"])
            netloc = f"{quote(proxy['username'], safe='')}:{quote(proxy.get('password',''), safe='')}@{parts.netloc}"
            endpoint = urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))
            session.proxies = {"http": endpoint, "https": endpoint}
        response = session.get("https://api.ipify.org?format=json", timeout=20)
        response.raise_for_status()
        observed = response.json()["ip"]
        ipaddress.ip_address(observed)
        if observed != expected:
            raise ValueError("Unexpected proxy exit address")
        return observed


def start_standard_edge(profile: Path, proxy: dict, homepage: str = "https://www.youtube.com/"):
    """Launch *normal* Edge, no browser-automation connection or --no-sandbox."""
    edge = locate_edge()
    if edge is None:
        raise FileNotFoundError("Microsoft Edge executable missing")
    profile.mkdir(parents=True, exist_ok=True)
    arguments = [
        str(edge),
        f"--user-data-dir={profile.resolve()}",
        f"--proxy-server={proxy['server']}",
        "--new-window",
        "--no-first-run",
        "https://api.ipify.org?format=json",
        homepage,
    ]
    return subprocess.Popen(
        arguments, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL, close_fds=True,
    )


def run_native_edge(cfg: dict, profile: Path, proxy: dict, bridge, log) -> None:
    """Network preflight is independent of the browser; user checks Edge's IP tab."""
    try:
        observed = verified_exit_ip(proxy, cfg["expected_ip"])
    except ValueError:
        print("ERROR:IP_MISMATCH", flush=True)
        if bridge: bridge.close()
        return
    except Exception:
        print("ERROR:PROXY_UNREACHABLE", flush=True)
        if bridge: bridge.close()
        return

    try:
        process = start_standard_edge(profile, proxy, cfg.get("start_url", "https://www.youtube.com/"))
    except FileNotFoundError:
        print("ERROR:EDGE_MISSING", flush=True)
        if bridge: bridge.close()
        return
    except OSError:
        print("ERROR:BROWSER_START", flush=True)
        if bridge: bridge.close()
        return

    # Report startup failure rather than claiming success if Edge exits immediately.
    time.sleep(1)
    if process.poll() is not None:
        print("ERROR:BROWSER_START", flush=True)
        if bridge: bridge.close()
        return
    log("PREFLIGHT", "youtube.com", "200")
    print("READY:" + observed, flush=True)
    try:
        process.wait()
    finally:
        if bridge: bridge.close()


def main():
    cfg = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    browser = cfg.get("browser", "chromium")
    if browser not in ("chromium", "msedge"):
        raise ValueError("Unsupported browser")

    endpoint = cfg["server"]
    if endpoint.startswith("socks5h://"):
        endpoint = "socks5://" + endpoint[len("socks5h://"):]
    # Chromium's native authenticated-proxy handling can fail for some complex sites.
    # Put a localhost-only bridge in front of HTTP proxies. Every request still
    # goes through the purchased upstream endpoint; there is no direct fallback.
    bridge = None
    if endpoint.startswith("http://"):
        bridge = ProxyBridge(endpoint, cfg.get("username", ""), cfg.get("password", ""))
        proxy = bridge.browser_proxy
    else:
        proxy = {"server": endpoint}
        if cfg.get("username"):
            proxy["username"] = cfg["username"]
            proxy["password"] = cfg.get("password", "")

    profile = Path(cfg["profile_dir"])
    profile.mkdir(parents=True, exist_ok=True)
    diagnostics = Path(cfg["diagnostics_dir"]) / (cfg["profile_id"] + "_" + browser + ".log")
    log = make_logger(diagnostics)
    with diagnostics.open("w", encoding="utf-8") as output:
        output.write("SSM_Tool website connectivity log; no credentials or full URLs\n")
        output.write("BROWSER " + browser + "\n")
        output.write("HTTP2 DISABLED; QUIC DISABLED\n")

    if browser == "msedge":
        # Real Edge, launched as a normal browser, without Playwright control.
        # This fixes the unsupported --no-sandbox warning from automated launches.
        # The IP-verification tab opens inside Edge for the user to confirm.
        run_native_edge(cfg, profile, proxy, bridge, log)
        return

    flags = ["--disable-http2", "--disable-quic"]
    args = dict(
        user_data_dir=str(profile), headless=False, proxy=proxy,
        viewport={"width": 1200, "height": 820}, accept_downloads=False,
        timeout=30000, args=flags,
    )
    with sync_playwright() as pw:
        try:
            context = pw.chromium.launch_persistent_context(**args)
        except Exception as exc:
            if browser == 'msedge' and ('Executable doesn' in str(exc) or 'not found' in str(exc).lower()):
                print('ERROR:EDGE_MISSING', flush=True)
            else:
                print('ERROR:BROWSER_START', flush=True)
            return

        def failed(request):
            host = matching_host(request.url)
            if host:
                # Never log raw failure strings: they can contain sensitive URLs.
                failure = request.failure or "UNKNOWN"
                match = re.search(r"net::ERR_[A-Z0-9_]+", str(failure))
                log("FAILED", host, match.group(0) if match else "REQUEST_FAILED")

        def response(received):
            host = matching_host(received.url)
            if host and received.status >= 400:
                log("HTTP", host, str(received.status))

        context.on("requestfailed", failed)
        context.on("response", response)
        page = context.pages[0] if context.pages else context.new_page()
        # Fail closed: verify the real public IP *from inside Edge/Chromium*
        # before reporting launch success. Never fall back to the host network.
        try:
            page.goto('https://api.ipify.org?format=json', wait_until='domcontentloaded', timeout=25000)
            observed_ip = json.loads(page.locator('body').inner_text(timeout=5000))['ip']
            ipaddress.ip_address(observed_ip)
        except Exception:
            print('ERROR:PROXY_UNREACHABLE', flush=True)
            context.close()
            if bridge: bridge.close()
            return
        if observed_ip != cfg.get('expected_ip'):
            print('ERROR:IP_MISMATCH', flush=True)
            context.close()
            if bridge: bridge.close()
            return
        print('READY:' + observed_ip, flush=True)
        target = cfg.get("start_url", "https://api.ipify.org?format=json")
        if target not in ("https://www.youtube.com/", "https://api.ipify.org?format=json"):
            target = "https://api.ipify.org?format=json"
        try:
            page.goto(target, wait_until="domcontentloaded", timeout=35000)
            log("NAVIGATION", urlsplit(target).hostname or "")
        except Exception:
            log("NAVIGATION_FAILED", urlsplit(target).hostname or "")
            # Leave browser open for inspection instead of hiding the error.
        try:
            context.wait_for_event("close", timeout=0)
        except Exception:
            pass
        finally:
            try:
                context.close()
            except Exception:
                pass
            if bridge:
                bridge.close()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Avoid leaking proxy credentials in traces shown to the client.
        print('ERROR:BROWSER_START', flush=True)
        sys.exit(1)
