#!/usr/bin/env python3
"""
HACCP Tracker - Fase 1: portale di preparazione rete (nativo host, senza Docker).

Gira sulla porta 80 dell'hotspot HACCP-Setup-XXXXXX (192.168.4.1) PRIMA che la
web app sia installata. Permette di:
  - vedere schede di rete (Ethernet / Wi-Fi, anche doppia scheda) e stato Internet
  - scansionare e collegarsi a un Wi-Fi esterno (scheda client separata se presente)
  - avviare l'installazione "live" della web app (Fase 2) e seguirne il log

Solo libreria standard Python 3. Si spegne da solo quando la Fase 2 avvia il container.
"""
import json
import os
import re
import shutil
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

APP_DIR = os.environ.get("APP_DIR", "/opt/haccp-tracker")
DATA_DIR = os.path.join(APP_DIR, "data")
STATE_FILE = os.path.join(DATA_DIR, "onboarding_state.json")
INSTALL_LOG = os.path.join(DATA_DIR, "phase2-install.log")
AP_IFACE = os.environ.get("HACCP_AP_IFACE", "")
PORT = int(os.environ.get("HACCP_ONBOARDING_PORT", "80"))
SSID_RE = re.compile(r"^[^\x00-\x1f]{1,32}$")
LOCK = threading.Lock()


def run(cmd, timeout=20):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return r.returncode, (r.stdout or "") + (r.stderr or "")
    except Exception as exc:  # noqa: BLE001
        return 1, str(exc)


def has(cmd):
    return shutil.which(cmd) is not None


def read_state():
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return {"phase": "network", "install": "idle"}


def write_state(**kw):
    with LOCK:
        st = read_state()
        st.update(kw)
        st["updated"] = time.strftime("%Y-%m-%dT%H:%M:%S")
        os.makedirs(DATA_DIR, exist_ok=True)
        tmp = STATE_FILE + ".tmp"
        with open(tmp, "w") as f:
            json.dump(st, f)
        os.chmod(tmp, 0o600)
        os.replace(tmp, STATE_FILE)
        return st


def iface_ipv4(name):
    _, out = run(["ip", "-4", "-o", "addr", "show", "dev", name])
    m = re.search(r"inet (\d+\.\d+\.\d+\.\d+)", out)
    return m.group(1) if m else ""


def list_interfaces():
    res = []
    try:
        names = sorted(os.listdir("/sys/class/net"))
    except OSError:
        names = []
    for name in names:
        if name == "lo" or name.startswith(("docker", "br-", "veth")):
            continue
        base = "/sys/class/net/" + name
        wireless = os.path.isdir(base + "/wireless") or os.path.isdir(base + "/phy80211")
        if not wireless and not os.path.exists(base + "/device"):
            continue
        try:
            carrier = open(base + "/carrier").read().strip() == "1"
        except Exception:  # noqa: BLE001
            carrier = False
        connected_ssid = ""
        if wireless and has("iw"):
            _, out = run(["iw", "dev", name, "link"])
            m = re.search(r"SSID: (.+)", out)
            connected_ssid = m.group(1).strip() if m else ""
        res.append({
            "name": name,
            "type": "wifi" if wireless else "ethernet",
            "ip": iface_ipv4(name),
            "carrier": carrier,
            "role": "hotspot" if name == AP_IFACE else ("client" if wireless else "uplink"),
            "ssid": connected_ssid,
        })
    return res


def internet_ok():
    code, _ = run(["ping", "-c", "1", "-W", "3", "1.1.1.1"], timeout=6)
    if code != 0:
        return False
    code, _ = run(["getent", "hosts", "github.com"], timeout=6)
    return code == 0


def client_wifi_ifaces():
    return [i["name"] for i in list_interfaces() if i["type"] == "wifi" and i["name"] != AP_IFACE]


def scan_wifi():
    ifaces = client_wifi_ifaces()
    iface = ifaces[0] if ifaces else AP_IFACE
    nets = {}
    if has("nmcli"):
        run(["nmcli", "dev", "wifi", "rescan", "ifname", iface], timeout=15)
        _, out = run(["nmcli", "-t", "-f", "SSID,SIGNAL,SECURITY", "dev", "wifi", "list", "ifname", iface], timeout=15)
        for line in out.splitlines():
            parts = re.split(r"(?<!\\):", line)
            if len(parts) >= 3 and parts[0]:
                ssid = parts[0].replace("\\:", ":")
                sig = int(parts[1] or 0)
                if ssid not in nets or nets[ssid]["signal"] < sig:
                    nets[ssid] = {"ssid": ssid, "signal": sig, "secure": parts[2] not in ("", "--")}
    elif has("iw"):
        _, out = run(["iw", "dev", iface, "scan"], timeout=20)
        for block in out.split("\nBSS ")[1:]:
            m = re.search(r"SSID: (.+)", block)
            s = re.search(r"signal: (-?\d+)", block)
            if m and m.group(1).strip():
                ssid = m.group(1).strip()
                sig = max(0, min(100, 2 * (int(s.group(1)) + 100))) if s else 0
                nets[ssid] = {"ssid": ssid, "signal": sig, "secure": "RSN" in block or "WPA" in block}
    return {"iface": iface, "dual": bool(ifaces), "networks": sorted(nets.values(), key=lambda n: -n["signal"])}


def connect_wifi(ssid, password):
    ifaces = client_wifi_ifaces()
    dual = bool(ifaces)
    iface = ifaces[0] if dual else AP_IFACE
    if not dual:
        # Scheda singola: l'hotspot verrà spento per collegarsi al Wi-Fi esterno.
        run([os.path.join(APP_DIR, "setup-hotspot.sh"), "--mode=normal", "--iface=" + iface], timeout=60)
    if has("nmcli"):
        run(["nmcli", "dev", "set", iface, "managed", "yes"])
        cmd = ["nmcli", "dev", "wifi", "connect", ssid, "ifname", iface]
        if password:
            cmd += ["password", password]
        code, out = run(cmd, timeout=45)
    else:
        conf = "/etc/wpa_supplicant/wpa_supplicant-%s.conf" % iface
        _, psk = run(["wpa_passphrase", ssid, password]) if password else (0, 'network={\n ssid="%s"\n key_mgmt=NONE\n}\n' % ssid)
        with open(conf, "w") as f:
            f.write("ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev\nupdate_config=1\ncountry=IT\n" + psk)
        os.chmod(conf, 0o600)
        run(["systemctl", "enable", "--now", "wpa_supplicant@%s.service" % iface], timeout=30)
        code, out = run(["dhclient", iface] if has("dhclient") else ["dhcpcd", iface], timeout=45)
    time.sleep(3)
    ok = internet_ok()
    if not ok and not dual:
        # Ripristina l'hotspot per non perdere l'accesso al portale
        run([os.path.join(APP_DIR, "setup-hotspot.sh"), "--mode=setup", "--iface=" + iface], timeout=90)
    write_state(uplink="wifi", wifi_ssid=ssid, wifi_iface=iface, network_ok=ok)
    return {"ok": ok, "dual": dual, "iface": iface, "detail": out[-400:]}


def start_install():
    st = read_state()
    if st.get("install") == "running":
        return {"ok": True, "already": True}
    if not internet_ok():
        return {"ok": False, "error": "Nessuna connessione Internet: collega cavo o Wi-Fi prima di installare."}
    write_state(install="running", phase="install")
    open(INSTALL_LOG, "w").close()
    cmd = "bash %s/install.sh --phase2 --non-interactive > %s 2>&1; echo $? > %s.rc" % (APP_DIR, INSTALL_LOG, INSTALL_LOG)
    # systemd-run: sopravvive allo stop del portale durante la Fase 2
    if has("systemd-run"):
        subprocess.Popen(["systemd-run", "--unit=haccp-phase2-%d" % int(time.time()), "--collect", "bash", "-c", cmd])
    else:
        subprocess.Popen(["setsid", "bash", "-c", cmd])
    return {"ok": True}


def status():
    st = read_state()
    rc_file = INSTALL_LOG + ".rc"
    if st.get("install") == "running" and os.path.exists(rc_file):
        rc = open(rc_file).read().strip()
        st = write_state(install="done" if rc == "0" else "failed")
    ifs = list_interfaces()
    return {
        "interfaces": ifs,
        "ethernet": any(i["type"] == "ethernet" and i["carrier"] and i["ip"] for i in ifs),
        "wifi_cards": len([i for i in ifs if i["type"] == "wifi"]),
        "internet": internet_ok(),
        "ap_iface": AP_IFACE,
        "state": st,
    }


def tail_log(n=200):
    try:
        with open(INSTALL_LOG, errors="replace") as f:
            lines = f.readlines()[-n:]
        return re.sub(r"\x1b\[[0-9;]*m", "", "".join(lines))
    except Exception:  # noqa: BLE001
        return ""


HTML_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index.html")


class Handler(BaseHTTPRequestHandler):
    server_version = "HACCP-Onboarding"

    def log_message(self, fmt, *args):
        pass

    def _json(self, code, obj):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > 4096:
            return {}
        try:
            return json.loads(self.rfile.read(n) or b"{}")
        except Exception:  # noqa: BLE001
            return {}

    def do_GET(self):
        p = self.path.split("?")[0]
        if p == "/api/onboarding/status":
            return self._json(200, status())
        if p == "/api/onboarding/scan":
            return self._json(200, scan_wifi())
        if p == "/api/onboarding/log":
            return self._json(200, {"log": tail_log(), "state": read_state()})
        if p in ("/api/health", "/api/setup-check"):
            return self._json(200, {"onboarding": True, "needsSetup": True})
        # Captive portal: qualsiasi altra URL mostra il portale
        try:
            with open(HTML_PATH, "rb") as f:
                data = f.read()
        except Exception:  # noqa: BLE001
            data = b"<h1>HACCP Setup</h1>"
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        p = self.path.split("?")[0]
        body = self._body()
        if p == "/api/onboarding/connect":
            ssid = str(body.get("ssid", "")).strip()
            pw = str(body.get("password", ""))
            if not SSID_RE.match(ssid):
                return self._json(400, {"ok": False, "error": "Nome rete non valido"})
            if pw and not (8 <= len(pw) <= 63):
                return self._json(400, {"ok": False, "error": "La password Wi-Fi deve avere 8-63 caratteri"})
            res = connect_wifi(ssid, pw)
            if res["ok"] and body.get("auto_install"):
                start_install()
            return self._json(200, res)
        if p == "/api/onboarding/use-ethernet":
            ok = internet_ok()
            write_state(uplink="ethernet", network_ok=ok)
            return self._json(200, {"ok": ok})
        if p == "/api/onboarding/install":
            res = start_install()
            return self._json(200 if res.get("ok") else 409, res)
        return self._json(404, {"error": "not found"})


if __name__ == "__main__":
    write_state()
    print("HACCP onboarding portal su :%d (hotspot: %s)" % (PORT, AP_IFACE or "?"), flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
