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


export NETENV=TESTNET
npx hardhat compile

UPGRADE=upgradeGateways

NETWORK=ok_test $UPGRADE
NETWORK=heco_test $UPGRADE
NETWORK=bsc_test $UPGRADE

#NETWORK=ok_test upgradeVaults
#NETWORK=heco_test upgradeVaults
#NETWORK=bsc_test upgradeVaults
