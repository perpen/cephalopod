FROM centos:7
COPY . /pod
RUN /pod/provision/provision
ENTRYPOINT ["/pod/runtime/entrypoint"]
