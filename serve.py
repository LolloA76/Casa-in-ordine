"""Anteprima esclusivamente locale: nessun tunnel o pubblicazione."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os
os.chdir(Path(__file__).resolve().parent)
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Content-Security-Policy', "frame-ancestors 'none'")
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
        super().end_headers()
print('Prova locale: http://127.0.0.1:8765 — solo dati fittizi. Ctrl+C per fermare.', flush=True)
ThreadingHTTPServer(('127.0.0.1', 8765), Handler).serve_forever()
