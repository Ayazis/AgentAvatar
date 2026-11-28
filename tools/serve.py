"""Serve the project for local work, telling the browser not to cache anything.

The page is split into ES modules; with plain `python -m http.server` the browser may keep an old copy of a
module after it changes. Usage: python tools/serve.py [port]   (default 8765)
"""
import functools
import http.server
import pathlib
import sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    root = pathlib.Path(__file__).resolve().parent.parent
    handler = functools.partial(NoCache, directory=str(root))
    print(f'Serving {root} at http://localhost:{port}')
    http.server.ThreadingHTTPServer(('', port), handler).serve_forever()
