set -e
deploy() {
    yarn tags Mocks --reset
    yarn tags Config --reset
    yarn tags Vaults --reset
    yarn tags Gateways --reset
    yarn tags MockInit 
}
npx hardhat compile
NETWORK=chainA deploy
NETWORK=chainB deploy
node tools/init.js
