const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const INTERFACE = '127.0.0.1';
const USER = null;

const THEIA_PATH_RX = new RegExp('^/pod/(\\d+)/theia($|/.*)');
function theia(req) {
  var matches = THEIA_PATH_RX.exec(req.url);
  if (!matches) return null;
  return null;
}

const WETTY_PATH_RX = new RegExp('^/pod/(\\d+)/wetty(/.*)?$');
function wetty(req) {
    console.log("req.url: '" + req.url + '"');
    var matches = WETTY_PATH_RX.exec(req.url);
    if (!matches) return null;

    var path = '/wetty' + (matches[2] || '/');
    var pod_number = parseInt(matches[1]);
    var pod_port = 3000 + 10 * pod_number + 1;
    req.headers['host'] = "127.0.0.1";

    return {
        host: "127.0.0.1",
        port: pod_port,
        method: req.method,
        path: path,
        headers: req.headers
    };
}

var proxyHandler = function(req, res) {

    console.log("Request for " + req.url);

    var proxy_params = null;
    for (let backend of [theia, wetty]) {
        if (proxy_params = backend(req)) break;
    }
    if (proxy_params == null) {
        return false;
//        console.log("ERROR Request for " + req.url + ": no handler found");
//        res.writeHead(503, {
//            'content-type': 'text/html'
//        });
//        res.end('cannot handle it');
//        return;
    }
    console.log(proxy_params);

    var proxy_req = http.request(proxy_params, function(proxy_res) {
        if (proxy_res.headers.connection) {
            if (req.headers.connection) {
                proxy_res.headers.connection = req.headers.connection;
            } else {
                proxy_res.headers.connection = 'close';
            }
        }

        res.writeHead(proxy_res.statusCode, proxy_res.headers);
        // No 'data' event and no 'end' * Missing this will lead to oddness - don't ask.
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
    proxyHandler(req, res) || fileHandler(req, res);
}

http.createServer().addListener("request", handler).listen(PORT, INTERFACE);

if (USER) {
    console.log("Switching to user " + USER);
    process.setuid(USER);
}

console.log(`Serving on ${INTERFACE}:${PORT}`);
