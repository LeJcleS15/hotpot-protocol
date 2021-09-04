set -e
deploy() {
    yarn tags Access
    yarn tags Router
    yarn tags Config
    yarn tags Vaults
    yarn tags Gateways
    yarn tags Lens
}

deployRouterV2() {
    yarn tags Router
}

deployExtCaller() {
    yarn tags ExtCaller
}

bind() {
    yarn tags Bind
}

net() {
    if [ "$NETENV" == "MAINNET" ];then
        echo $1_main
    else
        echo $1_test
    fi
}

#export NETENV=TESTNET
export NETENV=MAINNET
npx hardhat compile

ACTION=deployExtCaller

NETWORK=`net ok` $ACTION
NETWORK=`net heco` $ACTION
NETWORK=`net bsc` $ACTION



