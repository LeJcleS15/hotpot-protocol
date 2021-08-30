set -e
upgradeVaults() {
    yarn tags upgradeVaults
}
upgradeGateways() {
    yarn tags upgradeGateways
}

upgradeLens() {
    yarn tags upgradeLens
}

upgradeAccess() {
    yarn tags upgradeAccess
}

upgradeConfig() {
    yarn tags upgradeConfig
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

UPGRADE=upgradeGateways

NETWORK=`net ok` $UPGRADE
NETWORK=`net heco` $UPGRADE
NETWORK=`net bsc` $UPGRADE

