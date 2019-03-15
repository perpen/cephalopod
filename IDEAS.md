POD PAGE
========
Info:
- owner
- creation date
- avg cpu and ram
Links:
- node page
- [theia] running
- [wetty] stopped
Actions:
- decrypt

MAINTENANCE
===========
- kill containers (or just processes) using lots cpu/ram/processes/files for too long
- kill wetty/theia on inactivity. Can be done from pod.js? But how does it detect
  activity on websocket?
- user/team contributing nodes have higher quota

ARCHIVAL
========
- archive containers on inactivity, with creation params next to archive
- the pod page shows the current user's archives, and provides button to restore.
  it will be restored to a different node/number.
  there is a limit to number of archives per user.
- if stored externally, snapshots must be encrypted as may contain secrets.
- only owner can restore
- cleanup old snapshots
- if a pod has been archived, when we access its url we should be informed
  and given option to restore, or recreate
- On pod creation, normalise and hash params (except image version?)
  url is /pod/3-USER-HASH
  url is /pod/3-ID

PORTAL
======
- ldap authentication
- Page with form:
  - Base image
  - Home url
  - Project urls (with search)
- Gets defaults from query params
- User should be able to request pod with curl, then just ssh into it
  $ curl http://pod-portal/pod -F image=tooling -F home=<home url> -F user=43880338
  {url: http://pod/<pod id>,
   estimated-days-left: 4,
   ssh: {port: 3030, host: node-a, number: 3, cmd: "ssh -p 3030 joe@node-a"}}
- the pod page shows the current user's recent pods and archives, and provides button
  to restore.
- Link in a README:
  http://pod-portal/create?image=tooling&home=<home url>&projects=<project url>
  - When clicked, opens page prompting for staff id.
- For HA, have portal run on all nodes, and they talk to each other to share
  load/age data.
- Use param or user-agent or accept header to decide whether to show launch page?
- pod creation:
  - find available range of 10 ports
    - start from 2000-2009, pod id 0; 2010/2019 pod id 1
  - start container with ports
    - 0: ssh
    - 1: UIs, ssl terminating in pod's haproxy
    - n: tcp
  - to use:
    - ssh node-a.sit.modelt -p 3030
    - chrome https://node-a.sit.modelt:3031/pod/3/wetty
- starting UIs
  - a placeholder server constantly monitors the UIs and starts a server on their
    port if they are not running.
  - if there are unencrypted secrets, it asks for decryption key
  - placeholder asks for owner password before starting UI
  - it stops its server on the UI port, then starts UI

TODO
====
- lint js
- provide script for creating tunnels
- portal:
  - input: linux-home url required, projects urls optional
- project specifics
  - project can have .pod config with preferred image and optionally version
- ldap login (either integrated, or on login)
  - why would i need it? what's the risk if i create box using another's home files?
  - and some may choose to use a team account for this.
  - but secrets url could be a param. Have generic url params: linux-home, secrets,
    whatever - all of them with an init script.
    - eg: docker run pod joe \\
          http://stash/tooling/linux-home \\
          http://stash/joe/secrets \\
          --repos http://stash/fxt/model-t-build,http://stash/fxt/bundle-keepie
- copy/paste
- Name parameter? Appended to owner name (real name instead of staff id?)
- security:
  - ssl, supported by wetty
  - is it ok to give sudo?
  - alpine ok or need internal rhel7 image?
- pod-secrets decrypt should ask again if wrong passphrase
- random:
  - use terminal as ui, eg for portal or model-t
    - needs node to exit when done
    - use readline for input
- pairing
  - stop pairing when owner disconnects. is timeout still necessary?
- garbage collecting
  - delete container w/o connection for 2 hours
- use chromium standalone app to get all keyboard shortcuts?
- ssh should only login by ssh key?
- get a wildmark ssl cert
- add start/stop commands to pod-wetty/theia scripts
- show in status bar if theia is running
- have user login to portal, and store its display name and groups
- maven/npm caches:
  - make fake /etc/hosts entry for nexus, directing to a local caching proxy
    only caches artifact files (not snapshots)
  - caches for all nodes are sync'd
- calls to api from a pod:
  - each pod gets a token, used to check call is made by the pod
  - example calls: pod archive <archive persistence in days, max 30>; pod move <node>
- Minimise size of image:
  - delete wetty/theia files not required at runtime
  - uninstall rpms not required at runtime
- easier theia dev: make a theia repo in stash, push package to nexus
- CI
