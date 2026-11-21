# A tiny DNS server for the Android emulator (which doesn't read the Mac's /etc/hosts): the demo domain answers
# 10.0.2.2 (the Mac, seen from the emulator); every other name is forwarded to a public resolver unchanged.
# Usage: python3 demo-sites/dns.py, then start the emulator with -dns-server 127.0.0.1. Stop it when recording ends.
import os, socket, struct, threading

DOMAIN = os.environ.get('DEMO_DOMAIN', 'www.yourlocalfooddeliveryservice.com').lower().removeprefix('www.')
HOST_IP = '10.0.2.2'
UPSTREAM = ('1.1.1.1', 53)

def qname(data):
    i, parts = 12, []
    while data[i]:
        n = data[i]; parts.append(data[i + 1:i + 1 + n].decode().lower()); i += n + 1
    return '.'.join(parts), i + 1

def answer(data):
    name, end = qname(data)
    qtype = struct.unpack('>H', data[end:end + 2])[0]
    if name != DOMAIN and not name.endswith('.' + DOMAIN): return None
    flags = 0x8180
    if qtype == 1:  # A
        an = b'\xc0\x0c' + struct.pack('>HHIH', 1, 1, 60, 4) + socket.inet_aton(HOST_IP); count = 1
    else:  # AAAA and the rest: no data, so the A answer is used
        an = b''; count = 0
    return data[:2] + struct.pack('>HHHHH', flags, 1, count, 0, 0) + data[12:end + 4] + an

def handle(sock, data, addr):
    try:
        reply = answer(data)
        if reply is None:
            up = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); up.settimeout(4)
            up.sendto(data, UPSTREAM); reply, _ = up.recvfrom(4096); up.close()
        sock.sendto(reply, addr)
    except Exception as e:
        print('dns:', e)

# this Mac's own addresses (the emulator's queries come from one of them)
import subprocess
LOCAL = {'127.0.0.1', *subprocess.run(['sh', '-c', "ifconfig | awk '/inet /{print $2}'"], capture_output=True, text=True).stdout.split()}
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
# macOS lets a normal user bind port 53 only on every interface; requests from other machines are ignored.
s.bind(('0.0.0.0', 53))
print(f'dns: {DOMAIN} -> {HOST_IP}, others -> {UPSTREAM[0]}', flush=True)
while True:
    data, addr = s.recvfrom(4096)
    if addr[0] not in LOCAL: print('dns: ignored', addr[0], flush=True); continue
    threading.Thread(target=handle, args=(s, data, addr), daemon=True).start()
