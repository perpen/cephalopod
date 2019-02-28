CEPHALO + POD
=============
Two sub-projects:
- cephalo: portal, ochestrator
  - UI and REST API for managing pods
  - Reverse proxy to each pod via paths /pod/POD_NUMBER/(wetty,theia)
  - SSL termination
  - Basic auth for access to theia
- pod: the container and its app
  - The container process is sshd
  - Reverse proxy to wetty (terminal) and theia (IDE) apps
    via path /pod/POD_NUMBER/(wetty|theia)

ACCESS TO POD
=============
- `$ ssh -p PORT STAFF_ID@node`
  Where `PORT` = 3000 + 10 * POD_NUMBER
- Terminal in browser: https://node/pod/POD_NUMBER/wetty
- IDE in browser: https://node/pod/POD_NUMBER/theia
- Other ports: For now users will have to create ssh tunnels to the pod.

AUTH
====
Users authenticate to the portal or the containers via AD.

Only the creator of a pod can:
- Connect to its theia UI
- Kill the pod

Other users can connect to a pod via wetty or ssh as user pair/pair. They
will be able to view or type on the owner's main tmux session if explicitly
authorised.

SECURITY
========


TECHS
=====
- docker
- Terminal emulation: https://xtermjs.org/
- Web app using xtermjs: https://github.com/krishnasrinivas/wetty
- VS Code like IDE: https://www.theia-ide.org/
- node: UIs, APIs, proxying

FILES
=====


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
    - /pod/pod-profile.sh sourced by user's .bash_profile
        - Decrypts user secrets
        - Clones projects into ~/src        
        - Starts tmux

UPDATING THE DOCKER BASE IMAGE
==============================
This assumes you can run docker from your workstation.
```
workstation $ cd ./pod
# Hack the provisioning script
workstation $ vim build/provision
# In a new terminal start a container running a shell on rhel base image
workstation $ ./build/container-shell centos:7
# As you are changing the script, test it by running it in the container
# Keep the script idempotent to make development easier.
container $ /pod/build/provision
# Manually start the container's entrypoint (use your own staff id and name)
container $ /pod/runtime/entrypoint 0 none 43880338 "Henri" \
    FIXME https://github.com/perpen/pod-linux-home.git \
    FIXME https://github.com/krishnasrinivas/wetty.git
```

You can then test the pod via:
- ssh -p 2999 43880338@localhost
- http://localhost:3000/wetty
- http://localhost:3000/theia
- http://localhost:3000/status
- etc

Finally push your changes to git and create a PR.

HOME DIRECTORY, SECRETS
=======================
