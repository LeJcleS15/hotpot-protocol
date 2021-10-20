set -e

Balancer() {
    echo "\n"
    echo "--------------------"$NETENV $NETWORK
    yarn tags Balancer
}


net() {
    if [ "$NETENV" == "MAINNET" ];then
        echo $1_main
    else
        echo $1_test
    fi
}

npx hardhat compile

NETWORK=`net arbitrum` Balancer
NETWORK=`net polygon` Balancer
NETWORK=`net ok` Balancer
NETWORK=`net heco` Balancer
NETWORK=`net bsc` Balancer
