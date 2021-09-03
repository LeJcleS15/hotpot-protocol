set -e

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

export NETENV=TESTNET
#export NETENV=MAINNET
npx hardhat compile

ACTION=setGas

NETWORK=`net ok` $ACTION
NETWORK=`net heco` $ACTION
NETWORK=`net bsc` $ACTION



