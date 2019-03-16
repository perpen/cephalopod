/*
HTTP entry point for the pod.
- Proxies /wetty and /theia to their respective app port on localhost
- For theia we won't get a chance to run the user init in the terminal,
  so if init has not been run we present a page which asks for the decryption
  key, so we can decrypt the secret and run the init before starting theia.
- FIXME use same mechanism to start wetty on demand
*/
const proxy = require('http-proxy-middleware')
const express = require('express')
const app = express()
const http = require('http')
const request = require('request')
const url = require('url')
const fs = require('fs')
const path = require('path')
const proc = require('child_process')
const bodyParser = require('body-parser')
const memoize = require('memoizee')

const PORT = 3000
const WETTY_PORT = 3001
const THEIA_PORT = 3002
const INTERFACE = '0.0.0.0'
const CONFIG = (() => {
    const dir = `${process.env.HOME}/.pod`
    return JSON.parse(fs.readFileSync(`${dir}/params.json`))
})()

function decryptionNeeded() {
    const hasSecrets = fs.existsSync(`${process.env.HOME}/.pod-secrets.gpg`)
    const decrypted = fs.existsSync(`${process.env.HOME}/.pod/secrets`)
    return hasSecrets && !decrypted
}

function startTheiaIfNotRunning() {
    const theiaPath = `http://127.0.0.1:${THEIA_PORT}` //FIXME
    request.head(theiaPath, (error, response, body) => {
        if (!response) {
            console.log("STARTING THEIA")
            // proc.spawn('pod', ['theia', 'start'])
            proc.spawn('bash', ['-c', 'pod theia start &> /tmp/t'])
        }
    })
}

function decrypted(req, res) {
    console.log('decrypted')
    res.status(200).send(!decryptionNeeded())
}

function decrypt(req, res) {
    console.log('decrypt')
    // Maybe we decrypted from somewhere else, check again
    if (!decryptionNeeded()) {
        res.status(202).end()
        return
    }

    const decryptionKey = req.body.key
    const homedir = `${process.env.HOME}`

    // We pipe the key from this process to prevent it from appearing in ps output
    const gpg = proc.spawn('bash',
      ['-c', `gpg -d --batch --passphrase-fd 0 --cipher-algo aes256 ${homedir}/.pod-secrets.gpg | tar xfz - -C ${homedir}`],
      {stdio: 'pipe'})
      // {stdio: ['pipe', process.stdout, process.stderr]})

    gpg.on('close', (code) => {
      console.log(`decrypting exit code ${code}`)
      if (code == 0) {
        res.status(202).end()
      } else {
        res.status(400).end()
      }
    })
    gpg.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`)
    })
    gpg.stderr.on('data', (data) => {
      console.log(`stderr: ${data}`)
    })
    gpg.on('error', (err) => {
      console.log('error decrypting secrets', err)
      res.status(500).end()
    })

    gpg.stdin.write(decryptionKey + '\n')
    gpg.stdin.end()
}

function startUi(req, res) {
    console.log('startUi')
    const ui = req.body.ui
    const starter = {
      'wetty': () => { proc.spawn('sudo', ['pod', 'wetty' , 'start']) },
      'theia': () => { proc.spawn('pod', ['theia', 'start']) },
    }[ui]
    if (!starter) {
      console.error(`startUi: unknown ui ${ui}`)
      return
    }
    starter()
}

function podStatus(req, res) {
    console.log(`target host: ${req.headers['host']}`)
    if (req.url != '/status') return false

    const top = proc.spawnSync('top', ['-bn1'])
    CONFIG['top'] = top.stderr.toString() + '\n' + top.stdout.toString()
    // FIXME do i need su minus?
    const pairing = proc.spawnSync('su', ['-', CONFIG.user, '-c', `pod pairing status`])
    CONFIG['pairing'] = pairing.stdout.toString()

    res.setHeader('Content-type', 'application/json')
    res.end(JSON.stringify(CONFIG))
    return true
}
const podStatusMemo = memoize(podStatus, {maxAge: 30000})

//////////////////////////////// UIs

function setupUiRoute(server, ui, port) {
    const context = `/${ui}`
    app.get(context, function(req, res, next) {
      if (req.originalUrl.slice(-1) == '/') return next()
      res.redirect(`${req.originalUrl}/`)
    })

    const rewriteOption = {}
    rewriteOption[`^${context}/`] = '/'

    const theProxy = proxy(context, {
      target: `http://127.0.0.1:${port}`,
      pathRewrite: rewriteOption,
      ws: true,
      logLevel: 'debug',
      onError: function onError(err, req, res) {
        console.log('uiProxy error', err)
        if (err.errno == 'ECONNREFUSED' && req.originalUrl == `${context}/`) {
          res.redirect(`/pod/${CONFIG.pod_number}/`)
          return
        }
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('Something went wrong. FIXME show some logs')
      },
    })

    app.use(theProxy)
    // server.on('upgrade', theProxy.upgrade)
}

//////////////////////////////// rest

app.use('/', express.static(path.join(__dirname, 'public')))
app.use(bodyParser.json())
app.get('/status', podStatusMemo)
app.get('/decrypt', decrypted)
app.post('/decrypt', decrypt)
app.post('/start', startUi)

//app.use(function (req, res, next) {
//    res.status(404).send('not found')
//})

var server = http.createServer()
server.on('request', app)
setupUiRoute(server, 'wetty', WETTY_PORT)
setupUiRoute(server, 'theia', THEIA_PORT)
server.on('error', (e) => console.log(`error: ${e}`))
server.listen(PORT, INTERFACE, () => console.log(`pod listening on port ${INTERFACE}:${PORT}`))
