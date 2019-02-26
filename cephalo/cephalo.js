/*
https://node-a/pod/3 -> pod-home app
https://node-a/pod/3/wetty -> http://localhost:3031
https://node-a/pod/3/theia -> http://localhost:3032
*/

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const INTERFACE = '127.0.0.1';
const USER = null;
const POD_PORT_RANGE_START = 3000
const POD_PORT_RANGE_WIDTH = 10

const HOME_PATH_RX = new RegExp('^/pod/(\\d+)/?$');

function home(req, res) {
    var matches = HOME_PATH_RX.exec(req.url);
    if (!matches) return false;

    var pod_number = parseInt(matches[1]);
    var owner = 'Joe';

    res.setHeader('Content-type', 'text/html');
    const html = `
      <html>
        <head>
          <title>pod ${pod_number}</title>
        </head>
        <body>
          <div>
            <h2>pod ${pod_number}</h2>
            Owner: ${owner}<br>
            <pre style="white-space:pre-line;">docker run --rm --name p3 --hostname p3 -v /home/henriducrocq/src/cephalopod/pod:/pod -p3030:22 -p 3031:3000 -p 3032:3001 columnated/pod:latest 3 wetty 43880338 Henri https://github.com/perpen/pod-linux-home.git https://github.com/krishnasrinivas/wetty.git</pre>
            <a href="/pod/${pod_number}/wetty/">wetty</a> <br>
            <a href="/pod/${pod_number}/theia/">theia</a> (stopped) <br>
          </div>
          <div>
            <h1>idea</h1>
            <h2>pod ${pod_number}</h2>
            Owner: ${owner}<br>
            <br>
            To start <a href="/pod/${pod_number}/wetty/">wetty</a> enter the password for Joe:
            <input type="password" name="password"/>
          </div>
        </body>
      </html>`;

    res.end(html);
    return true;
};

const UI_PATH_RX = new RegExp('^(/pod/(\\d+))((/(wetty|theia))(/.*)?)$');

function ui(req, res) {

    console.log("Request for " + req.url);

    var proxy_params;
    {
        var matches = UI_PATH_RX.exec(req.url);
        if (!matches) return false;

        req.headers['host'] = "127.0.0.1";
        // used to rewrite response cookies from post()
        req.ui_context = matches[1] + matches[4];
        var pod_number = parseInt(matches[2]);
        var pod_port = POD_PORT_RANGE_START + POD_PORT_RANGE_WIDTH * pod_number + 1;

        proxy_params = {
            host: "127.0.0.1",
            port: pod_port,
            method: req.method,
            path: (matches[6] || '/'),
            headers: req.headers
        };
    }
    if (proxy_params == null) {
        return false;
    }
    console.log(proxy_params);

    var proxy_req = http.request(proxy_params, function(proxy_res) {
        var cooks = proxy_res.headers['set-cookie'];
        if (cooks) {
            var new_cooks = [cooks[0].replace(/^(.* Path=)(.*)$/, "$1" + req.ui_context + "$2")];
            proxy_res.headers['set-cookie'] = new_cooks;
        }
        if (proxy_res.headers.connection) {
            if (req.headers.connection) {
                proxy_res.headers.connection = req.headers.connection;
            } else {
                proxy_res.headers.connection = 'close';
            }
        }

        res.writeHead(proxy_res.statusCode, proxy_res.headers);
        // FIXME ???
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

function fileHandler(req, res) {
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

//////////////////////////////////////////////////

process.on('uncaughtException', function(err) {
    console.log("ERROR:" + err);
    console.log(err.stack);
});

const handler = function(req, res) {
    home(req, res) || ui(req, res) || fileHandler(req, res);
}

http.createServer().addListener("request", handler).listen(PORT, INTERFACE);

if (USER) {
    console.log("Switching to user " + USER);
    process.setuid(USER);
}

console.log(`Serving on ${INTERFACE}:${PORT}`);
