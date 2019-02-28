/*
HTTP entry point for the pod.
- Proxies /wetty and /theia to their respective app port on localhost
- For theia we won't get a chance to run the user init in the terminal,
  so if init has not been run we present a page which asks for the decryption
  key, so we can decrypt the secret and run the init before starting theia.
- FIXME use same mechanism to start wetty on demand
*/
const proxy = require('http-proxy-middleware');
const app = require('express')();
const http = require('http');
const request = require('request');
const url = require('url');
const fs = require('fs');
const path = require('path');
const proc = require('child_process');
const bodyParser = require('body-parser');

const PORT = 3000;
const WETTY_PORT = 3001;
const THEIA_PORT = 3002;
const INTERFACE = '0.0.0.0';
const CONFIG = (() => {
    const dir = `${process.env.HOME}/.pod`;
    return JSON.parse(fs.readFileSync(`${dir}/params.json`));
})();

function decryptionNeeded() {
    // FIXME cache, this is called on each theia request
    // every 50 calls or 1mn?
    const hasSecrets = fs.existsSync(`${process.env.HOME}/.pod-secrets.gpg`);
    const decrypted = fs.existsSync(`${process.env.HOME}/.pod/secrets`);
    console.log(`has: ${hasSecrets}, decrypted: ${decrypted}`);
    return hasSecrets && !decrypted;
}

function startTheiaIfNotRunning() {
    const theiaPath = `http://127.0.0.1:${THEIA_PORT}`; //FIXME
    request.head(theiaPath, (error, response, body) => {
        if (!response) {
            console.log("STARTING THEIA");
        }
    });
}

function initTheia(req, res, next) {
    console.log('initTheia');
    if (req.method != 'GET' || !decryptionNeeded()) {
        next();
        return;
    }

    startTheiaIfNotRunning();

    console.log('decryptionNeeded');
    const theiaPath = `/pod/${CONFIG.pod_number}/theia`; //FIXME
    const decryptPath = `/pod/${CONFIG.pod_number}/decrypt`; //FIXME

    res.setHeader('Content-type', 'text/html');
    const html = `
      <html>
        <head>
          <title>${CONFIG.pod_number}@node-a</title>
        </head>
        <body>
          <div>
            <h2>pod ${CONFIG.pod_number}@node-a</h2>
            Owner: ${CONFIG.user_display_name} (${CONFIG.user})
            <br>
            <br>
            Theia <span id="theiaStatus">...</span>
            <br>
            <br>
            <div id="decryption">
              Decryption key for secrets in [linux-home url]:
              <input type="password" id="decryptionKey"/>
              <span id="decryptionError"/>
            </div>
          </div>
          <script>
            (function() {
              const decryptionElt = document.getElementById('decryption');
              const fieldElt = document.getElementById('decryptionKey');
              const errorElt = document.getElementById('decryptionError');
              const theiaStatusElt = document.getElementById('theiaStatus');

              const push = function() {
                fieldElt.disabled = true;
                const options = {
                  headers : { "content-type" : "application/json; charset=UTF-8"},
                  body : JSON.stringify({key: fieldElt.value}),
                  method : "POST",
                };

                fetch('${decryptPath}', options)
                  .then(res => {
                    console.log("res.ok:", res.ok);
                    if (res.ok) {
                      decryptionElt.innerHTML = "";
                    } else {
                      errorElt.innerHTML = "decryption failed";
                      fieldElt.disabled = false;
                    }
                  });
              };

              fieldElt.onkeydown = () => {
                  if (window.event.keyCode=='13') push();
              }

              const theiaOptions = {
                headers : { "content-type" : "application/json; charset=UTF-8"},
                method : "HEAD",
              };

              const theiaMonitor = function() {
                console.log('checking theia');
                fetch('${theiaPath}', theiaOptions)
                .then(res => {
                  console.log("res.ok:", res.ok);
                  if (res.ok) {
                    theiaStatus.innerHTML = "started";
                    location.reload(true);
                  } else {
                    theiaStatus.innerHTML = "starting...";
                  }
                })
                setTimeout(theiaMonitor, 2000);
              }
              theiaMonitor();
            })();
          </script>
        </body>
      </html>`;
    res.end(html);

}

// Process posted params
function decrypt(req, res) {
    console.log('decrypt');
    // Maybe we decrypted from somewhere else, check again
    if (!decryptionNeeded()) {
        next();
        return;
    }

    const decryptionKey = req.body.key;

    // decrypt!
    //fs.mkdir(`${process.env.HOME}/.pod/secrets`);
    const homedir = `${process.env.HOME}`;

    // We pipe the key from this process to prevent it from appearing in ps output
    const sink = proc.spawn('bash',
      ['-c', `gpg -d --batch --passphrase-fd 0 --cipher-algo aes256 ${homedir}/.pod-secrets.gpg | tar xfz - -C ${homedir}/.pod`],
      {stdio: ['pipe', process.stdout, process.stderr]});
    sink.on('close', (code) => {
      console.log(`decrypting exit code ${code}`);
      if (code == 0) {
        res.status(202).end();
      } else {
        res.status(400).end();
      }
    });
    sink.on('error', (err) => {
      console.log('error decrypting secrets', err);
      res.status(500).end();
    });

    sink.stdin.write(decryptionKey);
    sink.stdin.end();
}

function podStatus(req, res) {
    // console.log(req);
    console.log(`target host: ${req.headers['host']}`);
    if (req.url != '/status') return false;

    const ps = proc.spawnSync('ps', ['-ef']);
    config['ps'] = ps.stderr.toString() + '\n' + ps.stdout.toString();
    const top = proc.spawnSync('top', ['-bn1']);
    config['top'] = top.stderr.toString() + '\n' + top.stdout.toString();
    const pairing = proc.spawnSync('su', ['-', CONFIG.user, '-c', `pod pairing status`]);
    config['pairing'] = pairing.stdout.toString();
    console.log(config);

    res.headers['Content-type'] = 'application/json';
    res.end(JSON.stringify(config));
    return true;
}

// theia
app.use(/\/theia(\/.*)?$/, initTheia);
app.use('/theia', proxy({
  target: `http://localhost:${THEIA_PORT}`,
  pathRewrite: {'^/theia' : '/'},
  cookiePathRewrite: {
    '/': '/theia',
  },
  logLevel: 'debug'
}));

// wetty
// because my wetty fork uses relative paths for resources, we want the trailing slash.
app.get('/wetty', function(req, res, next) {
  if (req.originalUrl.slice(-1) == '/') return next();
  res.redirect(`/pod/${CONFIG.pod_number}/wetty/`);
});
app.use('/wetty', proxy({
  target: `http://localhost:${WETTY_PORT}`,
  pathRewrite: {'^/wetty/' : '/'},
  cookiePathRewrite: {
    '/': '/wetty',
  },
  logLevel: 'debug'
}));

// rest
app.use(bodyParser.json());
app.get('/status', podStatus);
app.post('/decrypt', decrypt);

app.use(function (req, res, next) {
    res.status(404).send('not found');
})

app.listen(PORT, INTERFACE, () => console.log(`Pod app listening on port ${PORT}`));