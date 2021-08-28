const record = require('../helps/record');
const ContractKey = ["Gateways"];
const Contract = "Gateway";


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

const FEE = 5;

const func = async function (hre) {
    const { ethers } = hre;
    const { getChainId } = hre;
    hre.chainId = await getChainId();

    const accounts = await ethers.getSigners();
    const deployAcc = accounts[0].address;
    console.log(deployAcc);

    const Deployed = record(hre.Record);
    const oldAddress = ContractKey.reduce((r, key) => r[key], Deployed);

    const remotePolyIds = Object.keys(oldAddress);
    const gateways = [];
    for (let i = 0; i < remotePolyIds.length; i++) {
        const remotePolyId = remotePolyIds[i];
        const srcGateways = oldAddress[remotePolyId];
        const symbols = Object.keys(srcGateways);
        const filterGates = symbols.map(symbol => srcGateways[symbol]);
        gateways.push(...filterGates);
    }
    //const gateways = Object.values(oldAddress).reduce((t, x) => [...t, ...Object.values(x)], []);
    for (let i = 0; i < gateways.length; i++) {
        const gateway = gateways[i];
        const oldC = await ContractAt(Contract, gateway);
        const fee = await oldC.fee();
        if (fee != FEE) {
            console.log('setFee:', FEE)
            await oldC.setFee(FEE);
        }
        console.log(i, await oldC.fee(), fee, FEE)
    }
};

module.exports = func;
func.tags = ['setFee'];