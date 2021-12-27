const record = require('../helps/record');
const ChainsData = require('../helps/chains');

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
    const { getChainId } = hre;
    hre.chainId = await getChainId();

    const accounts = await ethers.getSigners();
    const deployAcc = accounts[0].address;
    console.log(deployAcc);

    const chains = ChainsData(hre.Chains);
    const polyId = chains.polyId;
    const gateways = record(hre.Record, undefined, undefined, chains.chainId)['Gateways'];

    const remoteIds = Object.keys(gateways);
    for (let i = 0; i < remoteIds.length; i++) {
        const remoteId = remoteIds[i];
        const gateway = gateways[remoteId];
        const tokens = Object.keys(gateway);
        for (let j = 0; j < tokens.length; j++) {
            const tokenName = tokens[j];
            const gate = gateway[tokenName];
            const remoteChainId = chains._toChainId(remoteId);
            const remoteGateways = record(hre.Record, undefined, undefined, remoteChainId)['Gateways'];
            const remoteGate = remoteGateways[polyId][tokenName];
            console.log(`${i}-${j} ${tokenName} ${chains._polyToName(polyId)}:${gate} <- ${chains._polyToName(remoteId)}:${remoteGate}`)
            const gateContract = await ContractAt('Gateway', gate);
            const remotePolyId = await gateContract.remotePolyId();
            if (0 == remotePolyId) {
                console.log('binding...')
                await gateContract.bindGateway(remoteId, remoteGate);
                console.log(`complete bind`);
            } else {
                const remoteGateway = await gateContract.remoteGateway();
                if (remotePolyId != remoteId || remoteGateway != remoteGate) {
                    throw `${remotePolyId} != ${remoteId} || ${remoteGateway} != ${remoteGate}`
                }
            }
        }
    }
};

module.exports = func;
func.tags = ['Bind'];