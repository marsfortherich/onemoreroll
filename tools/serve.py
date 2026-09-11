"""Dev server for ONE MORE ROLL.

Plain `python -m http.server` lets the browser cache js/ and css/, which makes
"did my change land?" unanswerable during a visual pass. This serves the same
files with caching switched off.

    python tools/serve.py [port]
"""
import sys
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # quiet


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    print('ONE MORE ROLL dev server (no-cache) on http://localhost:%d' % port)
    ThreadingHTTPServer(('127.0.0.1', port), NoCacheHandler).serve_forever()
