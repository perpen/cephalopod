NEXT
====
- init
  - form
      - secrets key
  - decrypt secrets
  - clone repos
- ssh
  - form: terminal
- wetty
  - form: web
- theia
  - form: web

process:
- sshd + wetty + theia

PORTAL
======
- Page with form:
  - Base image
  - Home url
  - Project urls
- Could urls be asked on first use? Why?
  - Nicer to search for urls on browser than on tty
- User should be able to request pod with curl, then just ssh into it
  $ curl http://pod-portal/pod -F image=tooling -F home=<home url> -F user=43880338
  {url: http://pod3/<pod id>,
   estimated-days-left: 4,
   ssh: {port: 45917, host: pod3, cmd: "ssh -p 45917 joe@pod3"}}
- Link in a README:
  http://pod-portal/create?image=tooling&home=<home url>&projects=<project url>
  - When clicked, opens page prompting for staff id.
- For HA, have portal run on all nodes, and they talk to each other to share
  load data.
- Use param or user-agent or accept header to decide whether to show launch page?
- pod creation:
  - find available range of 10 ports
    - start from 2000-2009, pod id 0; 2010/2019 pod id 1
  - start container with ports
    - 0: ssh
    - 1: UIs, ssl terminating in pod's haproxy
    - n: tcp
  - to use:
    - ssh pods-a.sit.modelt -p 2010
    - chrome https://pods-a.sit.modelt:2011/wetty
    - later? chrome https://p1.pods-a.sit.modelt/wetty
      - easy to do with a arithmetic in haproxy, p(\d+) -> localhost:2000+(10*\1)
  - create dns for pod-ID.pods.sit.modelt
  - create proxy entry for https://<current node>/pod/<name>


FLOW
====
- Image build - Dockerfile
    - Copies scripts to /pod
    - Installs packages
    - Creates pair user
- Container start - /pod/entrypoint
    - Creates user
    - Calls /pod/user-init under user's uid
        - Clones user's linux-home
- Login
    - /pod/pod-profile.sh called by user's .bash_profile
        - Decrypts user secrets
        - Clones projects into ~/src        
        - Starts tmux

TODO
====
- expose port in container - tcp auto-ingress?
- portal:
  - input: linux-home url required, projects urls optional
  - portal is a k8s app which gets info from url or form, then redirects to
    the new pod.
  - http://localhost:3000/pod?projects=FXT/bundle-keepie:policies,43880338/noci
  - support branches. what if multiple branches of same repo? not happen
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
- hostname on k8s
  See https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/#pods
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
- fancy stuff
  - initialise tmux with 1 window per project, and the 3 panes
- find simple init method for tmux
- tab title should be pod name
- use chromium standalone app to get all keyboard shortcuts?
- gender-neutral instead of joe, "user"?
- ssh should only login by ssh key?
- move pod* scripts to /pod/cli
- rewrite pod script case stmt to looking commands pod-*
- haproxy should default to page with instructions re. starting wetty or theia
- get a wildmark ssl cert
- add start/stop commands to pod-wetty/theia scripts
- have user login to portal, and store its display name and groups
- haproxy 503 page should redirect to /
- landing page:
  - poll the services to display availability in real-time
- maven/npm caches:
  - make fake /etc/hosts entry for nexus, directing to a local caching proxy
    only caches artifact files (not snapshots)
  - caches for all nodes are sync'd
- maintenance
  - kill containers (or just processes) using lots cpu/ram/processes/files for too long
  - archive containers on inactivity, with creation params next to archive
    - the pod page shows it is archived, and provides button to restore.
      it may be restored on a different node.
  - if stored externally, snapshots must be encrypted as may contain secrets.
  - only owner can restore
  - cleanup old snapshots
- calls to api from a pod:
  - each pod gets a token, used to check call is made by the pod
  - example calls: pod archive <timeout in days, max 30>, pod move

IMPROVEMENTS
============
- Minimise size of image:
  - delete wetty/theia files not required at runtime
  - uninstall rpms not required at runtime
