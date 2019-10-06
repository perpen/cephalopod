const os = require('os')
const proxy = require('http-proxy-middleware')
const express = require('express')
const app = express()
const http = require('http')
const request = require('request')
const fs = require('fs')
const path = require('path')
const proc = require('child_process')
const bodyParser = require('body-parser')

const PORT = 8080
const INTERFACE = '0.0.0.0'
const POD_PORT_RANGE_START = 3000
const POD_PORT_RANGE_WIDTH = 10
const POD_PATH_RX = new RegExp('^(/pod/(\\d+))(/.*)?$')
const COOKIE_PATH_RX = /^(.* Path=)(.*)$/
const CONTAINER_NAME_RX = /^p(\d+)$/
const DOCKER_STATS_HEADERS = new RegExp("^CONTAINER ID +NAME +CPU % +MEM USAGE / LIMIT +MEM % +NET I/O +BLOCK I/O +PIDS$")
const DOCKER_STATS_VALUES = new RegExp("^([^ ]+) +p([0-9]+) +([0-9.]+)% +([^ ]+) / ([^ ]+) +([^ ]+)% +([^ ]+) / ([^ ]+) +([^ ]+) / ([^ ]+) +([^ ]+)$")

const CONFIG = (() => {
  return {
    hostname: os.hostname(),
    baseUrl: `http://localhost:${PORT}`,
}})()

//////////////////////////////// rest

var podStatsByNumber

// regularly updates podStats object
function collectPodsStats() {
    const lines = proc.spawnSync('docker', ['stats', '--no-stream'])
      .stdout.toString().trim().split('\n')
    if (!DOCKER_STATS_HEADERS.test(lines[0])) {
      console.error(`unexpected docker stats output: ${lines[0]}`)
      return {}
    }
    const stats = {}
    lines.slice(1).forEach(line => {
      const matches = DOCKER_STATS_VALUES.exec(line)
      if (!matches) {
        console.error(`unexpected docker stats output: ${line}`)
        return {}
      }

      let [all, containerId, podNumber, cpu, memUsage, memLimit, memPercent,
           netIn, netOut, blockIn, blockOut, pids] = matches
      const metrics = {
        containerId: containerId,
        podNumber: parseInt(podNumber),
        cpu: cpu,
        memUsage: memUsage,
        memLimit: memLimit,
        memPercent: memPercent,
        netIn: netIn,
        netOut: netOut,
        blockIn: blockIn,
        blockOut: blockOut,
        pids: pids
      }

      let statusUrl = `${CONFIG.baseUrl}/pod/${podNumber}/status`
      request({
          url: statusUrl,
        },
        (err, res, body) => {
          if (err) {
            console.error(`error getting ${statusUrl}`, err)
            return
          }
          const podStatus = JSON.parse(body)
          podStatus['metrics'] = metrics
          stats[parseInt(podNumber)] = podStatus
        })
    })
    podStatsByNumber = stats
    setTimeout(collectPodsStats, 10000)
}
collectPodsStats()

function restPodStats(req, res) {
  const podNumber = req.params.podNumber
  res.setHeader('Content-type', 'application/json')
  res.end(JSON.stringify(podStatsByNumber[podNumber]))
}

function restStats(req, res) {
    res.setHeader('Content-type', 'application/json')
    res.end(JSON.stringify(podStatsByNumber))
}

function nextPodNumber() {
  // FIXME should be persistent, cluster-wide
  const NEXT_POD_NUMBER_PATH = '/tmp/next-pod-number'
  const num = parseInt(fs.readFileSync(NEXT_POD_NUMBER_PATH))
  fs.writeFileSync(NEXT_POD_NUMBER_PATH, `${num + 1}`)
  return num
}

function restCreate(req, res) {
  const homedir = req.body.homedir
  const projects = req.body.projects
  const user = '43880338'
  const userDisplayName = 'Ducrocq, Henri'
  const podNumber = nextPodNumber()

  const args = [
    'columnated/pod:latest',
    `${podNumber}`,
    'wetty',
    user,
    userDisplayName,
  ]
  .concat([homedir])
  .concat(projects)
  console.log(args)
  proc.spawn('./start-pod', args)

  res.setHeader('Content-type', 'application/json')
  res.end(JSON.stringify(`${CONFIG.baseUrl}/pod/${podNumber}/`))
}

//////////////////////////////// proxy to pod

function podPort(podNumber) {
  return POD_PORT_RANGE_START + podNumber * POD_PORT_RANGE_WIDTH
}

function podBasePath(url) {
  const matches = POD_PATH_RX.exec(url)
  if (!matches) return undefined
  return `/pod/${matches[2]}`
}

const theProxy = proxy({
  target: 'dummy', // will be calculated by router func below

  ws: true, // wetty and theia use websockets

  pathRewrite: (path, req) => {
    console.log(`path: ${path}`)
    return path.replace(/^\/pod\/\d+/, '/')
  },

  logLevel: 'debug',

  // We calculate the container port number from the pod number in the url
  // FIXME cache it
  router: req => {
    const matches = POD_PATH_RX.exec(req.url)
    if (!matches) return `http://127.0.0.1:${PORT}` // go home

    const number = parseInt(matches[2])
    const path = matches[3] || ''
    const port = podPort(number) + 1
    const target = `http://127.0.0.1:${port}`
    return target
  },

  // Rewrite cookie path to differentiate between cookies of different
  // apps on same pod, and of same apps on different pods
  onProxyRes: (proxyRes, req, res) => {
    var cookies = proxyRes.headers['set-cookie']
    if (cookies) {
      cookies = cookies.map(cookie => {
        const pathMatches = COOKIE_PATH_RX.exec(cookie)
        if (!pathMatches) return cookie
        const podPath = podBasePath(req.originalUrl)
        return pathMatches[1] + podPath + pathMatches[2]
      })
      console.log(`cookies: ${cookies}`)
      proxyRes.headers['set-cookie'] = cookies
    }
    return res
  }
})

app.use(POD_PATH_RX, theProxy)
app.use('/', express.static(path.join(__dirname, 'public')))
//app.use(function (req, res, next) {
//    res.status(404).send('not found')
//})
app.use(bodyParser.json())
app.get('/stats/:podNumber', restPodStats)
app.get('/stats', restStats)
app.post('/create', restCreate)

var server = http.createServer()
server.on('request', app)
server.on('upgrade', theProxy.upgrade)
server.on('error', (e) => console.log(`error: ${e}`))
server.listen(PORT, INTERFACE, () => console.log(`cephalo listening on port ${INTERFACE}:${PORT}`))
