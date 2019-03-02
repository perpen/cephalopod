var proxy = require('http-proxy-middleware');
var http = require('http');
var app = require('express')();

const PORT = 8080;
const INTERFACE = '0.0.0.0';
const POD_PORT_RANGE_START = 3000;
const POD_PORT_RANGE_WIDTH = 10;
const POD_PATH_RX = new RegExp('^(/pod/(\\d+))(/.*)?$');
const COOKIE_PATH_RX = /^(.* Path=)(.*)$/;

function podPort(podNumber) {
  return POD_PORT_RANGE_START + podNumber * POD_PORT_RANGE_WIDTH;
}

function podBasePath(url) {
  const matches = POD_PATH_RX.exec(url);
  if (!matches) return undefined;
  return `/pod/${matches[2]}`;
}

const theProxy000 = proxy({
  target: 'dummy',

  ws: true,
  // changeOrigin: true,

  pathRewrite: (path, req) => {
    console.log(`path: ${path}`);
    return path.replace(/^\/pod\/\d+\//, '/');
  },

  logLevel: 'debug',

  // We calculate the container port number from the pod number in the url
  // FIXME cache it
  router: req => {
    const matches = POD_PATH_RX.exec(req.url);
    if (!matches) return `http://127.0.0.1:${PORT}`; // go home

    const number = parseInt(matches[2]);
    const path = matches[3] || '';
    const port = podPort(number) + 1;
    const target = `http://127.0.0.1:${port}`;
    return target;
  },

  // Rewrite cookie path to differentiate between cookies of different
  // apps on same pod, and of same apps on different pods
  onProxyRes: (proxyRes, req, res) => {
    var cookies = proxyRes.headers['set-cookie'];
    if (cookies) {
      cookies = cookies.map(cookie => {
        const pathMatches = COOKIE_PATH_RX.exec(cookie);
        if (!pathMatches) return cookie;
        const podPath = podBasePath(req.originalUrl);
        return pathMatches[1] + podPath + pathMatches[2];
      });
      console.log(`cookies: ${cookies}`);
      proxyRes.headers['set-cookie'] = cookies;
    }
    return res;
  }
});

const theProxy = proxy({
  target: `http://127.0.0.1:3031/theia`,
  ws: true,
  // changeOrigin: true,
  pathRewrite: {'^/pod/3/' : '/'},
  logLevel: 'debug',
  onError: function onError(err, req, res) {
    console.log('theProxy error', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('Something went wrong.')
  },
});

app.use('/pod/3', theProxy);
// app.get('/', (req, res) => res.send('FIXME this is the portal page'))
// app.get('/status', (req, res) => res.send('FIXME pods stats'))
//app.use(function (req, res, next) {
//    res.status(404).send('not found')
//})

var server = http.createServer();
server.on('request', app);
server.on('upgrade', theProxy.upgrade);
server.on('error', (e) => console.log(`error: ${e}`));
server.listen(PORT, INTERFACE, () => console.log(`cephalo listening on port ${INTERFACE}:${PORT}`));
