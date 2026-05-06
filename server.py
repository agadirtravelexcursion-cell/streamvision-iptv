#!/usr/bin/env python3
"""StreamVision IPTV — Server with built-in CORS proxy (localhost + Render)"""
import http.server
import socketserver
import urllib.request
import urllib.parse
import json
import sys
import os

PORT = int(os.environ.get('PORT', 8080))
DIR = os.path.dirname(os.path.abspath(__file__))
XTREAM_HOST = "http://smarters2026.sbs:8080"

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def do_GET(self):
        # Proxy endpoint: /api/xtream?action=get_live_categories
        if self.path.startswith('/api/xtream'):
            params = urllib.parse.urlparse(self.path).query
            url = f"{XTREAM_HOST}/player_api.php?{params}"
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'StreamVision/1.0'})
                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = resp.read()
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.send_header('Cache-Control', 'public, max-age=300')
                    self.end_headers()
                    self.wfile.write(data)
            except Exception as e:
                self.send_response(502)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
            return

        # Serve static files normally
        super().do_GET()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def log_message(self, format, *args):
        if '/api/' in str(args[0]):
            print(f"  → {args[0]}")
        else:
            pass  # Suppress static file logs

if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    print(f"""
╔══════════════════════════════════════╗
║    🎬 StreamVision IPTV Server       ║
║    Port: {PORT}                        ║
║                                      ║
║    Proxy: /api/xtream?action=...     ║
║    Static: {DIR}
╚══════════════════════════════════════╝
""")
    with socketserver.TCPServer(("", PORT), ProxyHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
