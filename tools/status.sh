set -e

status() {
    echo "\n"
    echo "--------------------"$NETENV $NETWORK
    yarn tags Status
}
export NETENV=LOCAL
NETWORK=chainA status
NETWORK=chainB status