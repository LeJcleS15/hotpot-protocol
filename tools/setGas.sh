set -e

setGas() {
    yarn tags Gas
}



export NETENV=TESTNET
npx hardhat compile

NETWORK=ok_test setGas
NETWORK=heco_test setGas
NETWORK=bsc_test setGas


