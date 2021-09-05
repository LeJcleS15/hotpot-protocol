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

ACTION=setFee

NETWORK=`net ok` $ACTION
NETWORK=`net heco` $ACTION
NETWORK=`net bsc` $ACTION


