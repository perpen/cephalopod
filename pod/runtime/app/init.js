/*
If we get here via /theia, the owner is already authenticated.

Cases:
1. first access to pod, no secrets.gpg
   - check for ~/.pod/wetty-enabled
     if not there, ask for owner password
   - ask for:
      - owner password
      - if secrets to decrypt, show decrypt key field
   - run `bash -c /pod/runtime/pod-profile.sh` unless ~/.pod/profiled exists
   - exit
2. first access to pod, with secrets.gpg
   - ask for owner password
   - ask for decryption key
   - decrypt secrets
   - run `bash -c /pod/runtime/pod-profile.sh`
   -

Container init on first access.
If file ~user/.pod/profiled is present, it exits.
Else it presents a web ui:
- If file ~/.pod-secrets.gpg is present, asks for decryption key and decrypts the file.
- Runs `bash -c /pod/runtime/pod-profile.sh`
*/

const app = require('express')();
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const proc = require('child_process');
const bodyParser = require('body-parser');

const APP_PORTS = {
    'wetty': 3001,
    'theia': 3002
}

function readConfig() {
    const dir = `${process.env.HOME}/.pod`;
    return JSON.parse(fs.readFileSync(`${dir}/params.json`));
}

function forWetty() {
    return port == WETTY_PORT;
}

function forTheia() {
    return port == THEIA_PORT;
}

function form(req, res) {
    const hasSecrets = fs.existsSync(`${process.env.HOME}/.pod-secrets.gpg`);
    const decrypted = fs.existsSync(`${process.env.HOME}/.pod/secrets`);
    const profiled = fs.existsSync(`${process.env.HOME}/.pod/profiled`);
    const config = readConfig();

    res.setHeader('Content-type', 'text/html');
    const html = `
      <html>
        <head>
          <title>${config.pod_number}@node-a</title>
        </head>
        <body>
          <div>
            <h2>pod ${config.pod_number}@node-a</h2>
            Owner: ${config.user_display_name} (${config.user})<br>
            Secrets? ${hasSecrets} <br>
            Decrypted? ${decrypted} <br>
            Profiled? ${profiled} <br>
            <a href="/pod/${config.pod_number}/wetty/">wetty</a> <br>
            <a href="/pod/${config.pod_number}/theia/">theia</a> <br>
            <br>
            FIXME - hide decryption input if not needed
            <form method="post" enctype="application/json">
              To start <a href="/pod/${config.pod_number}/wetty/">wetty</a>
              enter the password for ${config.user_display_name}:
              <input type="password" name="password"/>
              <br>
              To decrypt [linux-home url] enter the decryption key:
              <input type="password" name="decryption"/>
              <br>
              FIXME
              - disable inputs
              - post to /
              - on success poll app with HEAD, then reload
              - on error enable inputs, show error msg from server
              <input type="submit"/>
            </form>
          </div>
        </body>
      </html>`;
    res.end(html);
}

function init(req, res) {
    const password = req.body.password;
    console.log("password:", password);
    const decryption = req.body.decryption;
    console.log("decryption:", decryption);

    const hasSecrets = fs.existsSync(`${process.env.HOME}/.pod-secrets.gpg`);
    const decrypted = fs.existsSync(`${process.env.HOME}/.pod/secrets`);
    const profiled = fs.existsSync(`${process.env.HOME}/.pod/profiled`);
    const config = readConfig();

    res.redirect(req.originalUrl);
}

///////////////////////////////////

if (process.argv.length != 3 || !['wetty', 'theia'].includes(process.argv[2])) {
    console.log('Usage: init.js (wetty|theia)');
    process.exit(2);
}
const appName = process.argv[2];

app.use(bodyParser.json());
app.get('/', form);
app.post('/', init);
app.use(function (req, res, next) {
    res.status(404).send("Sorry can't find that!");
})

const port = APP_PORTS[appName];
app.listen(port, () => console.log(`Pod app listening on port ${port}`));
