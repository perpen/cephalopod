FROM centos:7
COPY . /pod
RUN /pod/build/provision
ENTRYPOINT ["/pod/runtime/entrypoint"]
