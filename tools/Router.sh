set -e

Paused() {
    yarn tags Paused
}

withdrawNativeFee() {
    yarn tags withdrawNativeFee
}

setGas() {
    yarn tags Gas
}

net() {
    if [ "$NETENV" == "MAINNET" ];then
        echo $1_main
    else
        echo $1_test
    fi
}

npx hardhat compile

ACTION=withdrawNativeFee

NETWORK=`net ok` $ACTION
NETWORK=`net heco` $ACTION
NETWORK=`net bsc` $ACTION


