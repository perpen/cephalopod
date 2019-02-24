#!/bin/bash

# https://node-a/pod/3 -> http://localhost:3030
# https://node-a/pod/3/wetty -> http://localhost:3030/wetty
# https://node-a/pod/3/theia -> http://localhost:3030/theia
# OR
# https://pod-3.node-a -> http://localhost:3030
# https://pod-3.node-a/wetty -> http://localhost:3030/wetty
# https://pod-3.node-a/theia -> http://localhost:3030/theia


set -ex

certs() {
    openssl genrsa -out pod.key 2048
    openssl req -new -key pod.key -out pod.csr
    openssl x509 -req -days 365 -in pod.csr -signkey pod.key -out pod.crt
    cat pod.key pod.crt > pod.pem
}

start() {
    cat <<EOF > 503.http
HTTP/1.0 301 Go root
Location: http://localhost:3000

EOF

    cat <<'EOF' > pod.cfg
global
    tune.ssl.default-dh-param 2048
defaults
    mode http
    timeout connect 2s
    timeout client 2s
    timeout server 2s
    timeout tunnel 1d # for wetty's websocket
    # option httplog

    cat <<'EOF' >> pod.cfg
backend pod3
    server wetty1 localhost:3030
    http-request set-header Host localhost
    reqirep ^([^\ :]*)\ /pod/3/(.*)    \1\ /\2
    acl response-is-redirect res.hdr(Location) -m found
    rspirep ^Location:\ http://localhost:3030(.*)   Location:\ http://localhost:8080/pod/3\1  if response-is-redirect
    acl hdr_set_cookie_path res.hdr(Set-Cookie) -m sub Path=
    rspirep ^(Set-Cookie:.*)\ Path=/(.*) \1\ Path=/pod/3/\2 if hdr_set_cookie_path
EOF

    cat <<'EOF' >> pod.cfg
frontend localhost
    # bind *:443 ssl crt pod.pem
    bind *:8080
    use_backend pod3 if { path_beg /pod/3 }
    errorfile 503 503.http
EOF

    # nohup haproxy -f pod.cfg "$@" &
    haproxy -f pod.cfg "$@"
}

stop() {
    pkill -f "haproxy -f pod.cfg"
}

restart() {
    stop || true
    start "$@"
}

log() {
    less -Sin nohup.out
}

TMP=/var/tmp/cephalo-haproxy
mkdir -p $TMP
cd $TMP
eval "$@"
