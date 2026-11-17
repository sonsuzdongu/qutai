# Serves a demo site for recording (video/README.md), by default lokanta/ under the domain in DEMO_DOMAIN.
#   python3 serve.py                 https on 443 (certificate from make-cert.sh) and http on 80, which redirects to it
#   python3 serve.py --port 8090     plain http on that port only (for a quick look)
#   python3 serve.py --site other    another folder next to this script
# macOS lets a normal user open ports 80 and 443 only on all interfaces (0.0.0.0), so the site is reachable from the
# local network while this runs. It is a static demo with nothing to take; stop it (Ctrl-C) when the recording is done.
import argparse, functools, http.server, os, ssl, threading

HERE = os.path.dirname(os.path.abspath(__file__))
DOMAIN = os.environ.get('DEMO_DOMAIN', 'www.yourlocalfooddeliveryservice.com')

class Quiet(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, *a): pass

class ToHttps(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        host = (self.headers.get('Host') or DOMAIN).split(':')[0]
        self.send_response(301); self.send_header('Location', f'https://{host}{self.path}'); self.end_headers()
    do_HEAD = do_GET
    def log_message(self, *a): pass

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--port', type=int); ap.add_argument('--site', default='lokanta')
    a = ap.parse_args()
    handler = functools.partial(Quiet, directory=os.path.join(HERE, a.site))
    if a.port:
        print(f'http://localhost:{a.port}/'); http.server.ThreadingHTTPServer(('127.0.0.1', a.port), handler).serve_forever()
    cert = os.path.join(HERE, '.certs', 'site.pem'); key = os.path.join(HERE, '.certs', 'site.key')
    if not os.path.exists(cert): raise SystemExit('No certificate yet: run ./make-cert.sh first.')
    https = http.server.ThreadingHTTPServer(('0.0.0.0', 443), handler)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); ctx.load_cert_chain(cert, key)
    https.socket = ctx.wrap_socket(https.socket, server_side=True)
    threading.Thread(target=http.server.ThreadingHTTPServer(('0.0.0.0', 80), ToHttps).serve_forever, daemon=True).start()
    print(f'https://{DOMAIN}/  (and ?lang=en)')
    https.serve_forever()

if __name__ == '__main__':
    main()
