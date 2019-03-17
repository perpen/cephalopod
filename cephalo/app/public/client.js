(function() {
  const redraw = (eltIdToValue) => {
    Object.keys(eltIdToValue).forEach(id => {
      const elt = document.getElementById(id)
      if (elt) elt.innerHTML = eltIdToValue[id]
    })
  }

  // Retrieve pod info
  const podsMonitor = function() {
    console.log(`pod status`)
    const r = fetch('status')
      .then(res => res.json())
      .then(d => {
        redraw({
          pageTitle: `pod ${d.pod_number}@node`,
          sectionTitle: `pod ${d.pod_number}@node`,
          userDisplayName: d.user_display_name,
          user: d.user,
          topOutput: d.top.replace(/\n/g, "<br>"),
          homedirUrl: `<a id="homedirUrl" href="${d.homedir_url}">${d.homedir_url}</a>`,
        })
      })
    setTimeout(() => { podMonitor() }, 4000)
  }
  podsMonitor()
})()
