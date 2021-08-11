set -e

Balancer() {
    echo "\n"
    echo "--------------------"$NETENV $NETWORK
    yarn tags Balancer
}
export NETENV=TESTNET
NETWORK=bsc_test Balancer
NETWORK=heco_test Balancer
NETWORK=ok_test Balancer