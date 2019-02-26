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

//
function podDispatcher(req) {
  // console.log(req);
  console.log(req.originalUrl);
  const matches = POD_PATH_RX.exec(req.originalUrl);
  if (!matches) return `http://localhost:${PORT}`; //FIXME

  const number = parseInt(matches[1]);
  const path = matches[2] || '';
  const port = podPort(number);
  const url = `http://localhost:${port}${path}`;
  console.log(`target url: ${url}`);
  return url;
}

app.use(POD_PATH_RX, proxy(podDispatcher, {
    proxyReqPathResolver: function (req) {
      const matches = POD_PATH_RX.exec(req.originalUrl);
      console.log("req.url:", req.originalUrl);
      console.log("matches:", matches);
      return matches[2];
    }
  }));
app.get('/', (req, res) => res.send('Hello World!'))
app.use(function (req, res, next) {
    res.status(404).send("Sorry can't find that!")
})

const port = PORT;
app.listen(port, () => console.log(`Cephalo listening on port ${port}`))
