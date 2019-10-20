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
const url = require('url')
const fs = require('fs')
const path = require('path')
const proc = require('child_process')
const bodyParser = require('body-parser')

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

function restDecrypted(req, res) {
    console.log('restDecrypted')
    res.status(200).send(!decryptionNeeded())
}

function restDecrypt(req, res) {
    console.log('restDecrypt')
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

function restStartUi(req, res) {
    console.log('restStartUi')
    const ui = req.body.ui
    const starter = {
      'wetty': () => { proc.spawn('sudo', ['pod', 'wetty' , 'start']) },
      'theia': () => { proc.spawn('pod', ['theia', 'start']) },
    }[ui]
    if (!starter) {
      console.error(`restStartUi: unknown ui: ${ui}`)
      return
    }
    starter()
}

let topOutput = "<pending>"
function runTopContinuously() {
  const top = proc.spawn('top -b -d 30 2>&1', {shell: true})

  top.stdout.on('data', (data) => {
    topOutput = data.toString().trim()
  })
  top.on('close', (code) => {
    console.error(`strangely top exited with code ${code}, restarting it`)
    setTimeout(runTopContinuously, 5000)
  })
  top.on('error', (err) => {
    console.error('top error', err)
  })
}
runTopContinuously()

function restPodStatus(req, res) {
    console.log(`target host: ${req.headers['host']}`)

    CONFIG['top'] = topOutput

    res.setHeader('Content-type', 'application/json')
    res.end(JSON.stringify(CONFIG))
    return true
}

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
          res.redirect(`/pod/${CONFIG.podNumber}/`)
          return
        }
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('Something went wrong. FIXME show some logs')
      },
    })

    app.use(theProxy)
}

//////////////////////////////// rest

app.use('/', express.static(path.join(__dirname, 'public')))
app.use(bodyParser.json())
app.get('/status', restPodStatus)
app.get('/decrypt', restDecrypted)
app.post('/decrypt', restDecrypt)
app.post('/start', restStartUi)

//app.use(function (req, res, next) {
//    res.status(404).send('not found')
//})

var server = http.createServer()
server.on('request', app)
setupUiRoute(server, 'wetty', WETTY_PORT)
setupUiRoute(server, 'theia', THEIA_PORT)
server.on('error', (e) => console.log(`error: ${e}`))
server.listen(PORT, INTERFACE, () => console.log(`pod listening on port ${INTERFACE}:${PORT}`))
