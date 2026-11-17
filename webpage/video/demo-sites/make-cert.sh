#!/bin/sh
# A local certificate authority and a certificate for the demo domain, so the simulator opens the demo site over https
# with no warning. Everything stays in .certs/ (not committed). The authority is trusted only by the simulator it is
# added to (the booted one, or the UDID given), never by this Mac.
#   DEMO_DOMAIN=www.example.test ./make-cert.sh [simulator-udid]
set -e
cd "$(dirname "$0")"
DOMAIN="${DEMO_DOMAIN:-www.yourlocalfooddeliveryservice.com}"
BARE="${DOMAIN#www.}"
SIM="${1:-booted}"
mkdir -p .certs && cd .certs
if [ ! -f ca.pem ]; then
  openssl req -x509 -newkey rsa:2048 -nodes -keyout ca.key -out ca.pem -days 825 \
    -subj "/CN=Qutai video demo CA (local only)" \
    -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign" 2>/dev/null
fi
cat > site.ext <<EOF
basicConstraints=CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:$DOMAIN,DNS:$BARE
EOF
openssl req -newkey rsa:2048 -nodes -keyout site.key -out site.csr -subj "/CN=$DOMAIN" 2>/dev/null
openssl x509 -req -in site.csr -CA ca.pem -CAkey ca.key -CAcreateserial -out site.pem -days 365 -extfile site.ext 2>/dev/null
rm -f site.csr site.ext
xcrun simctl keychain "$SIM" add-root-cert ca.pem
echo "Certificate for $DOMAIN and $BARE; the authority is trusted in simulator: $SIM"
echo "Add to /etc/hosts (needs sudo):  127.0.0.1 $DOMAIN $BARE"
