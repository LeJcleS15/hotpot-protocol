set -e

status() {
    echo "\n"
    echo "--------------------"$NETENV $NETWORK
    yarn tags Status
}
export NETENV=TESTNET
#NETWORK=bsc_test status
#NETWORK=heco_test status
NETWORK=ok_test status