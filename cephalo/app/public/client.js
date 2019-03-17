(function() {
  const NODE_URL = document.location.href.replace(/[#\?].*$/, '')
  const MAX_PROJECT = 4
  let homeInput
  const inputs = []

  const redraw = (eltIdToValue) => {
    Object.keys(eltIdToValue).forEach(id => {
      const elt = document.getElementById(id)
      if (elt) elt.innerHTML = eltIdToValue[id]
    })
  }

  const updateMegalink = () => {
    console.log('updateMegalink')
    let megalink = `${NODE_URL}?`

    const homeParam = homeInput ? encodeURIComponent(homeInput.value.trim()) : ''
    if (homeParam.length > 0) megalink += `home=${homeParam}&`

    const projectsParam = inputs.map(input => {
      const url = input.value.trim()
      return encodeURIComponent(url)
    })
    .filter(url => url.length > 0)
    .join(",")
    if (projectsParam.length > 0) megalink += `projects=${projectsParam}`

    document.getElementById('megalink').value = megalink
  }

  const createInputs = () => {
    const parent = document.getElementById('createInputs')
    const createInput = (id) => {
      const div = document.createElement('div')
      const input = document.createElement('input')
      input.setAttribute('type', 'text')
      input.setAttribute('size', 40)
      input.setAttribute('id', id)
      input.addEventListener('input', updateMegalink)
      div.appendChild(input)
      parent.appendChild(div)
      return input
    }
    homeInput = createInput('home')
    for (let i = 1; i < MAX_PROJECT; i++) {
      const input = createInput(`project${i}`)
      inputs.push(input)
    }
  }

  // get projects from query params
  const impactQueryParams = () => {
    const queryParams = new URLSearchParams(window.location.search)
    const home = queryParams.get('home')
    if (home) {
      homeInput.value = home
    }
    const projects = queryParams.get('projects').split(',')
    let i = 1
    projects.forEach(project => {
      const elt = document.getElementById(`project${i}`)
      if (elt) elt.value = project
      i += 1
    })
  }

  createInputs()
  document.getElementById('copyMegalink').addEventListener('click', (evt) => {
    const elt = document.getElementById('megalink')
    elt.disabled = false
    elt.select()
    elt.disabled = true
    document.execCommand("copy")
  })
  impactQueryParams()
  updateMegalink()

  document.getElementById('createPod').onclick = () => {
    const urls = ['project1', 'project2'].map(eltId => {
        return document.getElementById(eltId).value
      })
      .filter(val => val)
    document.getElementById('createPod').innerHTML = 'creating...'
    document.getElementById('createPod').onclick = () => {}
    createPod(urls)
  }

  const createPod = (urls) => {
    console.log(`createPod: ${urls}`)
  }

  // Retrieve pod info
  const podsStatsMonitor = function() {
    console.log(`pod stats`)
    const r = fetch('stats')
      .then(res => res.json())
      .then(d => {
        redraw({
          pageTitle: `node`,
          sectionTitle: `node`,
        })
      })
    setTimeout(() => { podsStatsMonitor() }, 4000)
  }
  podsStatsMonitor()
})()
