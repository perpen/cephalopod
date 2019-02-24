SCRIPT_DIR=$(readlink -f $(dirname $0))
POD_PORT_RANGE_START=3000
POD_PORT_RANGE_WIDTH=10

usage() {
    echo "Usage: $(basename $0) $*" 1>&2
    exit 2
}
