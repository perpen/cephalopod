#!/bin/bash

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

backend pod
    server pod1 localhost:3003
    http-request set-header Host localhost
    reqirep ^([^\ :]*)\ /(.*)    \1\ /\2
    acl response-is-redirect res.hdr(Location) -m found
    rspirep ^Location:\ http://localhost:3003(.*)   Location:\ http://localhost:3000\1  if response-is-redirect

backend wetty
    server wetty1 localhost:3001
    http-request set-header Host localhost
    #reqirep ^([^\ :]*)\ /wetty/(.*)    \1\ /\2
    acl response-is-redirect res.hdr(Location) -m found
    rspirep ^Location:\ http://localhost:3001(.*)   Location:\ http://localhost:3000/wetty\1  if response-is-redirect
    acl hdr_set_cookie_path res.hdr(Set-Cookie) -m sub Path=
    rspirep ^(Set-Cookie:.*)\ Path=/(.*) \1\ Path=/wetty/\2 if hdr_set_cookie_path

backend theia
    server theia1 localhost:3002
    http-request set-header Host localhost
    reqirep ^([^\ :]*)\ /theia/(.*)    \1\ /\2
    acl response-is-redirect res.hdr(Location) -m found
    rspirep ^Location:\ http://localhost:3002\/(.*)   Location:\ http://localhost:3000/theia/\1  if response-is-redirect
    acl hdr_set_cookie_path res.hdr(Set-Cookie) -m sub Path=
    rspirep ^(Set-Cookie:.*)\ Path=/(.*) \1\ Path=/theia/\2 if hdr_set_cookie_path

frontend localhost
    # bind *:3000 ssl crt pod.pem
    bind *:3000

    acl is_root path -i /

    # Redirect eg /wetty to /wetty/
    #acl missing_slash path_reg ^/[^/\.]+$
    #http-request redirect code 301 prefix / drop-query append-slash if missing_slash

    use_backend pod if is_root
    use_backend wetty if { path_beg /wetty }
    use_backend theia if { path_beg /theia/ }
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
