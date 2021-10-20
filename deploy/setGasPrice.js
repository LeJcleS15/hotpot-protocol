const record = require('../helps/record');
const ChainsData = require('../helps/chains');


Number.prototype.toAddress = function () {
    const hexStr = ethers.BigNumber.from(Number(this)).toHexString().slice(2);
    const pad = 40 - hexStr.length;
    return `0x${'0'.repeat(pad)}${hexStr}`;
}
String.prototype.toAddress = Number.prototype.toAddress;

function ContractAt(Contract, address) {
    return ethers.getSigners().then(
        account => ethers.getContractAt(
            Contract,
            address,
            account[0]
        )
    );
}

const GasPirces = {
    "BSC": [400000, 5e9],
    "HECO": [400000, 2.5e9],
    "OEC": [400000, 0.1e9],
    "POLYGON": [1000000, 100e9],
    "ARBITRUM": [500000, 2e9]
}

const func = async function (hre) {
    const { deployments, ethers } = hre;
    const { deploy } = deployments;
    const { getChainId } = hre;
    hre.chainId = await getChainId();

    const accounts = await ethers.getSigners();
    const deployAcc = accounts[0].address;
    console.log(deployAcc);

    const Deployed = record(hre.Record);
    //const tokens = ChainsData(hre.Tokens);

    const chains = ChainsData(hre.Chains);

    const router = await ContractAt('Router', Deployed.RouterV2);

    const remotePolyIds = Object.keys(Deployed.Gateways);
    const gases = remotePolyIds.map(polyId => GasPirces[chains._polyToName(polyId)]);
    await router.setGas(remotePolyIds, gases.map(g => g[0]), gases.map(g => g[1]));
};

module.exports = func;
func.tags = ['Gas'];