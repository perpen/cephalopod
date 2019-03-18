(function() {
  var secretsDecrypted = false
  const decryptionElt = document.getElementById('decryption')
  const fieldElt = document.getElementById('decryptionKey')
  const theiaStatusElt = document.getElementById('theiaStatus')

  const redraw = (eltIdToValue) => {
    Object.keys(eltIdToValue).forEach(id => {
      const elt = document.getElementById(id)
      if (elt) elt.innerHTML = eltIdToValue[id]
    })
  }

  const decrypt = function(decryptionKey) {
    fieldElt.disabled = true
    const options = {
      headers : { "content-type" : "application/json; charset=UTF-8"},
      body : JSON.stringify({key: decryptionKey}),
      method : "POST",
    }
    fetch('decrypt', options)
    .then(res => { secretsMonitor() })
  }

  fieldElt.onkeydown = () => {
      if (window.event.keyCode=='13') decrypt(fieldElt.value)
  }

  const startUi = (name) => {
    console.log(`startUi ${name}`)
    const options = {
      headers : { "content-type" : "application/json; charset=UTF-8"},
      body : JSON.stringify({ui: name}),
      method : "POST",
    }
    fetch('start', options)
  }

  // Retrieve pod info
  const podMonitor = function() {
    console.log(`pod status`)
    const r = fetch('status')
      .then(res => res.json())
      .then(d => {
        redraw({
          pageTitle: `pod${d.podNumber}@node`,
          sectionTitle: `pod${d.podNumber}@<a href="/">node</a>`,
          userDisplayName: d.userDisplayName,
          user: d.user,
          topOutput: d.top.replace(/\n/g, "<br>"),
          homedirUrl: `<a id="homedirUrl" href="${d.homedirUrl}">${d.homedirUrl}</a>`,
        })
      })
    setTimeout(() => { podMonitor() }, 4000)
  }
  podMonitor()

  // Secrets decryption
  const secretsMonitor = function(repeatInSeconds) {
    console.log(`secrets`)
    const r = fetch('decrypt')
      .then(res => res.json())
      .then(decrypted => {
        secretsDecrypted = decrypted
        // decryptionElt.style = decrypted ? "display: none;" : "display: block;"
        decryptionElt.style = `display: ${decrypted ? 'none' : 'block'};`
        fieldElt.disabled = decrypted
      })
    if (repeatInSeconds) {
      setTimeout(() => { secretsMonitor(repeatInSeconds) }, repeatInSeconds * 1000)
    }
  }
  secretsMonitor(5)

  // Checks whether a UI is started
  const uiMonitor = function(name, path, testPath) {
    console.log(`checking ${name}`)
    const options = {
      headers : { "content-type" : "application/json; charset=UTF-8"},
      method : "HEAD",
    }
    fetch(testPath, options)
    .then(res => {
      const elt = document.getElementById(`${name}Status`)
      if (res.status == 200) {
        elt.innerHTML = `<a href="${path}">${name}</a>`
      } else {
        elt.innerHTML = `${name} <a id="${name}Starter" href="#">enable</a>`
        document.getElementById(`${name}Starter`).onclick = () => {
          startUi(name)
        }
      }
    })
    setTimeout(() => { uiMonitor(name, path, testPath) }, 4000)
  }
  uiMonitor('theia', 'theia/', 'theia/bundle.js')
  uiMonitor('wetty', 'wetty/' ,'wetty/public/index.js')
})()
