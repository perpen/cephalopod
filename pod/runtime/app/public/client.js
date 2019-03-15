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
    fetch('${decryptPath}', options)
      .then(res => {
        if (res.status === 202) {
          decryptionElt.innerHTML = ""
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
    const r = fetch('status', {
        // headers : { "content-type" : "application/json; charset=UTF-8"},
        // method : "GET",
      })
      .then(res => res.json())
      .then(d => {
        console.log(d)
        const data = {
          pageTitle: `pod ${d.pod_number}@node`,
          sectionTitle: `pod ${d.pod_number}@node`,
          userDisplayName: d.user_display_name,
          user: d.user,
          topOutput: d.top.replace(/\n/g, "<br>"),
        }
        redraw(data)
      })
    setTimeout(() => { podMonitor() }, 4000)
  }
  podMonitor()

  // Checks whether a UI is started
  const uiMonitor = function(name, path, testPath) {
    console.log(`checking ${name}`)
    const options = {
      headers : { "content-type" : "application/json; charset=UTF-8"},
      method : "HEAD",
    }
    fetch(testPath, options)
    .then(res => {
      const uiStatus = document.getElementById(`${name}Status`)
      if (res.ok) {
        // uiStatus.innerHTML = "started"
        uiStatus.innerHTML = `<a href="${path}">open</a>`
      } else {
        uiStatus.innerHTML = "stopped"
      }
    })
    setTimeout(() => { uiMonitor(name, path, testPath) }, 4000)
  }
  uiMonitor('theia', 'theia/', 'theia/bundle.js')
  uiMonitor('wetty', 'wetty/' ,'wetty/public/index.js')
})()
