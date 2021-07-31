const record = require('../helps/record');

function ContractAt(Contract, address) {
    return ethers.getSigners().then(
        account => ethers.getContractAt(
            Contract,
            address,
            account[0]
        )
    );
}

const func = async function (hre) {
    const { deployments, ethers } = hre;
    const { deploy } = deployments;

    const accounts = await ethers.getSigners();
    const deployAcc = accounts[0].address;
    console.log(deployAcc);

    const chainId = ethers.provider.network.chainId;
    const polyId = chainId;
    const gateways = record(hre.Record, undefined, undefined, polyId)['HotpotGates'];

    const remoteIds = Object.keys(gateways);
    for (let i = 0; i < remoteIds.length; i++) {
        const remoteId = remoteIds[i];
        const gateway = gateways[remoteIds];
        const tokens = Object.keys(gateway);
        for (let j = 0; j < tokens.length; j++) {
            const tokenName = tokens[j];
            const gate = gateway[tokenName];
            const remoteGateways = record(hre.Record, undefined, undefined, remoteId)['HotpotGates']
            const remoteGate = remoteGateways[polyId][tokenName];
            console.log(tokenName, gate)
            const gateContract = await ContractAt('HotpotGate', gate);
            await gateContract.bindGateway(remoteId, remoteGate);
            console.log(`bind ${tokenName} ${polyId}:${gate} <- ${remoteId}:${remoteGate}`);
        }
    }
};

module.exports = func;
func.tags = ['Bind'];