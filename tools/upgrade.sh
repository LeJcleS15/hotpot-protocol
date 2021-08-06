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


export NETENV=TESTNET
npx hardhat compile

#NETWORK=ok_test upgradeGateways
#NETWORK=heco_test upgradeGateways
#NETWORK=bsc_test upgradeGateways


#NETWORK=ok_test upgradeVaults
NETWORK=heco_test upgradeVaults
NETWORK=bsc_test upgradeVaults

