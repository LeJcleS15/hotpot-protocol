set -e
deploy() {
    yarn tags Access
    yarn tags Router
    yarn tags Config
    yarn tags Vaults
    yarn tags Gateways
}

bind() {
    yarn tags Bind
}
export NETENV=TESTNET
npx hardhat compile
#NETWORK=ok_test deploy
#NETWORK=heco_test deploy
#NETWORK=bsc_test deploy

NETWORK=ok_test bind
NETWORK=heco_test bind
NETWORK=bsc_test bind

