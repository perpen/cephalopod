FROM centos:7
COPY . /pod
# henri: nicing to avoid ui sluggishness on crostini
RUN nice /pod/build/provision
ENTRYPOINT ["/pod/runtime/entrypoint"]
