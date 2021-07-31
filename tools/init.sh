set -e
deploy() {
    yarn tags Mocks --reset
    yarn tags Access --reset
    yarn tags Router --reset
    yarn tags Config --reset
    yarn tags Vaults --reset
    yarn tags Gateways --reset
    yarn tags MockInit 
}

bind() {
    yarn tags Bind
}
npx hardhat compile
NETWORK=chainA deploy
NETWORK=chainB deploy
NETWORK=chainA bind
NETWORK=chainB bind
#node tools/init.js
