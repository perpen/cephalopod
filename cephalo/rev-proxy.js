const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const INTERFACE = '127.0.0.1';
const USER = null;
const WETTY_PATH_RX = new RegExp('^(/pod/(\\d+))((/(wetty|theia))(/.*)?)$');

function wetty(req, res) {
    var pre = function(req) {
        var matches = WETTY_PATH_RX.exec(req.url);
        if (!matches) return null;

        req.headers['host'] = "127.0.0.1";
        req.wetty_context = matches[1] + matches[4];
        var pod_number = parseInt(matches[2]);
        var pod_port = 3000 + 10 * pod_number + 1;

        return {
            host: "127.0.0.1",
            port: pod_port,
            method: req.method,
            path: (matches[3] || '/'),
            headers: req.headers
        };
    };
    var post = function(req, res) {
        var cooks = res.headers['set-cookie'];
        if (cooks) {
            var new_cooks = [cooks[0].replace(/^(.* Path=)(.*)$/, "$1" + req.wetty_context + "$2")];
            res.headers['set-cookie'] = new_cooks;
        }
        return res;
    };
    return proxyHack(pre, post, req, res);
}

function proxyHack(pre, post, req, res) {

    console.log("Request for " + req.url);

    var proxy_params = pre(req);
    if (proxy_params == null) {
        return false;
    }
    console.log(proxy_params);

    var proxy_req = http.request(proxy_params, function(proxy_res) {
        proxy_res = post(req, proxy_res);
        if (proxy_res.headers.connection) {
            if (req.headers.connection) {
                proxy_res.headers.connection = req.headers.connection;
            } else {
                proxy_res.headers.connection = 'close';
            }
        }

        res.writeHead(proxy_res.statusCode, proxy_res.headers);
        // No 'data' event and no 'end' * Missing this will lead to oddness - don't ask.??? FIXME
        if (proxy_res.statusCode === 304) {
            res.end();
            return;
        }
        proxy_res.addListener('data', function(chunk) {
            res.write(chunk, 'binary');
        });
        proxy_res.addListener('end', function() {
            res.end();
        });
    });

    proxy_req.on('error', function(e) {
        console.log("Request for " + req.url + " failed - back-end server caused exception : " + e);
        res.writeHead(503, {
            'content-type': 'text/html'
        });
        res.end('An error was encountered talking to the back-end server.');
        return;
    });

    req.addListener('data', function(chunk) {
        proxy_req.write(chunk, 'binary');
    });
    req.addListener('end', function() {
        proxy_req.end();
    });

    return true;
}

process.on('uncaughtException', function(err) {
    console.log("ERROR:" + err);
    console.log(err.stack);
});

// FIXME - does the path thing sanitise path eg ../ ??
var fileHandler = function (req, res) {
  console.log(`${req.method} ${req.url}`);

  const parsedUrl = url.parse(req.url);
  let pathname = `.${parsedUrl.pathname}`;
  const ext = path.parse(pathname).ext;
  const map = {
    '.ico': 'image/x-icon',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg'
  };

  fs.exists(pathname, function (exist) {
    if(!exist) {
      res.statusCode = 404;
      res.end(`File not found: ${pathname}`);
      return;
    }

    fs.readFile(pathname, function(err, data) {
      if (err){
        res.statusCode = 500;
        res.end(`Error getting the file: ${err}.`);
      } else {
        res.setHeader('Content-type', map[ext] || 'text/plain' );
        res.end(data);
      }
    });
  })
};

const handler = function(req, res) {
    wetty(req, res) || fileHandler(req, res);
}

http.createServer().addListener("request", handler).listen(PORT, INTERFACE);

if (USER) {
    console.log("Switching to user " + USER);
    process.setuid(USER);
}

console.log(`Serving on ${INTERFACE}:${PORT}`);
