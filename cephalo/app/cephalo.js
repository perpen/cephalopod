var proxy = require('express-http-proxy');
var app = require('express')();

const PORT = 8080;
const INTERFACE = '127.0.0.1';
const POD_PORT_RANGE_START = 3000;
const POD_PORT_RANGE_WIDTH = 10;
const POD_PATH_RX = new RegExp('^/pod/(\\d+)(/.*)?$');

function podPort(podNumber) {
  return POD_PORT_RANGE_START + podNumber * POD_PORT_RANGE_WIDTH;
}

// We calculate the port number for the container using the pod number in the url
function podDispatcher(req) {
  console.log(req.originalUrl);
  const matches = POD_PATH_RX.exec(req.originalUrl);
  if (!matches) return `http://localhost:${PORT}`; //FIXME

  const number = parseInt(matches[1]);
  const path = matches[2] || '';
  const port = podPort(number);
  return `http://localhost:${port}${path}`;
}

app.use(POD_PATH_RX, proxy(podDispatcher, {
    proxyReqPathResolver: function (req) {
      const matches = POD_PATH_RX.exec(req.originalUrl);
      console.log("req.url:", req.originalUrl);
      console.log("matches:", matches);
      return matches[2];
    }
  }));
app.get('/', (req, res) => res.send('FIXME this is the portal page'))
app.get('/status', (req, res) => res.send('FIXME pods stats'))
app.use(function (req, res, next) {
    res.status(404).send('not found')
})

app.listen(PORT, () => console.log(`Cephalo listening on port ${PORT}`))
