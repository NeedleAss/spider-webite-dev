#!/usr/bin/env python3
"""Local repository preview; revalidate assets, accept parallel ES module requests."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
class Preview(ThreadingHTTPServer):
    request_queue_size = 128
    daemon_threads = True
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(Path(__file__).resolve().parents[1]),**kwargs)
    def end_headers(self):
        self.send_header('Cache-Control','no-cache')
        super().end_headers()
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8765);args=parser.parse_args()
    Preview(('127.0.0.1',args.port),Handler).serve_forever()
