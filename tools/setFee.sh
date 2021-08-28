set -e

setFee() {
    yarn tags setFee
}

net() {
    if [ "$NETENV" == "MAINNET" ];then
        echo $1_main
    else
        echo $1_test
    fi
}

export NETENV=MAINNET
npx hardhat compile

NETWORK=`net ok` setFee
NETWORK=`net heco` setFee
NETWORK=`net bsc` setFee


