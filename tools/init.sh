set -e
deploy() {
    yarn tags Mocks --reset
    yarn tags Access --reset
    yarn tags Router --reset
    yarn tags Config --reset
    yarn tags Vaults --reset
    yarn tags Gateways --reset
}

bind() {
    yarn tags Bind
}
export NETENV=LOCAL
npx hardhat compile
NETWORK=chainA deploy
NETWORK=chainB deploy
NETWORK=chainA bind
NETWORK=chainB bind
tools/mockInit.sh
