set -e
upgradeVaults() {
    yarn tags upgradeVaults
}
upgradeGateways() {
    yarn tags upgradeGateways
}


export NETENV=TESTNET
npx hardhat compile

#NETWORK=ok_test upgradeGateways
NETWORK=heco_test upgradeGateways
NETWORK=bsc_test upgradeGateways

