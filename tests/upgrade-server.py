"""Fixture locale: simula l'aggiornamento dalla revisione Git precedente."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import subprocess, os
ROOT=Path(__file__).resolve().parents[1]
old=True
REVISION=os.environ.get('BASE_REVISION','18d9e4b0e2d4e71317123d63eaea3ccca11c9482')
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
 def log_message(self,*args):pass
 def do_POST(self):
  global old
  if self.path!='/__upgrade':self.send_error(404);return
  old=False;self.send_response(204);self.end_headers()
 def do_GET(self):
  if not old:return super().do_GET()
  name='index.html' if self.path=='/' else self.path.lstrip('/')
  if '..' in name or name.startswith('/') or '?' in name:self.send_error(404);return
  try:data=subprocess.check_output(['git','show',REVISION+':'+name],cwd=ROOT,stderr=subprocess.DEVNULL)
  except subprocess.CalledProcessError:self.send_error(404);return
  self.send_response(200);self.send_header('Content-Type',self.guess_type(name));self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-cache');self.end_headers();self.wfile.write(data)
ThreadingHTTPServer(('127.0.0.1',8777),Handler).serve_forever()
