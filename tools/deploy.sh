set -e
deploy() {
    yarn tags Access
    yarn tags Router
    yarn tags Config
    yarn tags Vaults
    yarn tags Gateways
    yarn tags Lens
}

bind() {
    yarn tags Bind
}
#export NETENV=TESTNET
export NETENV=MAINNET
npx hardhat compile
#NETWORK=ok_main deploy
#NETWORK=heco_main deploy
#NETWORK=bsc_main deploy

NETWORK=ok_main bind
NETWORK=heco_main bind
NETWORK=bsc_main bind

