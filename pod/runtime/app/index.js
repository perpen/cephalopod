const proxy = require('express-http-proxy');
const app = require('express')();
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const proc = require('child_process');

const PORT = 3000;
const WETTY_PORT = 3001;
const THEIA_PORT = 3002;
const INTERFACE = '127.0.0.1';

function readConfig() {
    const dir = `${process.env.HOME}/.pod`;
    return JSON.parse(fs.readFileSync(`${dir}/params.json`));
}

function podStatus(req, res) {
    // console.log(req);
    console.log(`target host: ${req.headers['host']}`);
    if (req.url != '/status') return false;

    const config = readConfig();
    const ps = proc.spawnSync('ps', ['-ef']);
    config['ps'] = ps.stderr.toString() + '\n' + ps.stdout.toString();
    const top = proc.spawnSync('top', ['-bn1']);
    config['top'] = top.stderr.toString() + '\n' + top.stdout.toString();
    const pairing = proc.spawnSync('su', ['-', config.user, '-c', `pod pairing status`]);
    config['pairing'] = pairing.stdout.toString();
    console.log(config);

    res.setHeader('Content-type', 'application/json');
    res.end(JSON.stringify(config));
    return true;
};

app.use('/theia', proxy(`http://localhost:${THEIA_PORT}`));
app.use('/wetty', proxy(`http://localhost:${WETTY_PORT}`));
app.get('/', (req, res) => res.send('Hello World!'));
app.get('/status', podStatus);
app.use(function (req, res, next) {
    res.status(404).send("Sorry can't find that!");
})

const port = PORT;
app.listen(port, () => console.log(`Pod app listening on port ${port}`));
