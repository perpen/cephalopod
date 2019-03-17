const os = require('os')
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

const PORT = 8080
const INTERFACE = '0.0.0.0'
const POD_PORT_RANGE_START = 3000
const POD_PORT_RANGE_WIDTH = 10
const POD_PATH_RX = new RegExp('^(/pod/(\\d+))(/.*)?$')
const COOKIE_PATH_RX = /^(.* Path=)(.*)$/

const CONFIG = (() => {
  return {
    hostname: os.hostname()
}})()

//////////////////////////////// rest

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

var server = http.createServer()
server.on('request', app)
server.on('upgrade', theProxy.upgrade)
server.on('error', (e) => console.log(`error: ${e}`))
server.listen(PORT, INTERFACE, () => console.log(`cephalo listening on port ${INTERFACE}:${PORT}`))
