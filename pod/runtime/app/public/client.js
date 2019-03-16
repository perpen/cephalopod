(function() {
  const decryptionElt = document.getElementById('decryption')
  const fieldElt = document.getElementById('decryptionKey')
  const theiaStatusElt = document.getElementById('theiaStatus')

  const data = {
    pageTitle: "?",
    sectionTitle: "?",
    userDisplayName: "?",
    user: "?",
    wettyStatus: "?",
    theiaStatus: "?",
    decryptionDisplay: "none"
  }
  const redraw = (data) => {
    Object.keys(data).forEach(id => {
      const elt = document.getElementById(id)
      if (elt) elt.innerHTML = data[id]
    })
  }
  redraw(data)

  const decrypt = function(decryptionKey) {
    fieldElt.disabled = true
    const options = {
      headers : { "content-type" : "application/json; charset=UTF-8"},
      body : JSON.stringify({key: decryptionKey}),
      method : "POST",
    }
    fetch('decrypt', options)
      .then(res => {
        if (res.status === 202) {
          decryptionElt.style = "display: none;"
          decrypted = true
        } else {
          fieldElt.disabled = false
        }
      })
  }

  fieldElt.onkeydown = () => {
      if (window.event.keyCode=='13') decrypt(fieldElt.value)
  }

  // Retrieve pod info
  const podMonitor = function() {
    console.log(`pod status`)
    const r = fetch('status')
      .then(res => res.json())
      .then(d => {
        console.log(d)
        const data = {
          pageTitle: `pod ${d.pod_number}@node`,
          sectionTitle: `pod ${d.pod_number}@node`,
          userDisplayName: d.user_display_name,
          user: d.user,
          topOutput: d.top.replace(/\n/g, "<br>"),
          homedirUrl: `<a id="homedirUrl" href="${d.homedir_url}">${d.homedir_url}</a>`,
        }
        redraw(data)
      })
    setTimeout(() => { podMonitor() }, 4000)
  }
  podMonitor()

  // Secrets decryption
  const secretsMonitor = function() {
    console.log(`secrets`)
    const r = fetch('decrypt')
      .then(res => res.json())
      .then(d => {
        console.log(d)
      })
    setTimeout(() => { secretsMonitor() }, 4000)
  }
  secretsMonitor()

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
        elt.innerHTML = "${name} stopped"
      }
    })
    setTimeout(() => { uiMonitor(name, path, testPath) }, 4000)
  }
  uiMonitor('theia', 'theia/', 'theia/bundle.js')
  uiMonitor('wetty', 'wetty/' ,'wetty/public/index.js')
})()
