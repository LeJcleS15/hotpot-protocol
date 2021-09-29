const record = require('../helps/record');
const ChainsData = require('../helps/chains');

async function deployProxyMulti(Contract, inputs, path) {
    const deployed = record(hre.Record)._path(path);
    if (deployed && !process.argv.includes('--reset')) return ContractAt(Contract, deployed);
    const factory = (await ethers.getContractFactory(
        Contract,
        (await ethers.getSigners())[0]
    ));
    const proxyed = await upgrades.deployProxy(factory, inputs);
    await proxyed.deployed();
    console.log(`>> Deployed ${Contract} at ${proxyed.address}`);
    record(hre.Record, path, proxyed.address);
    return proxyed;
}

function ContractAt(Contract, address) {
    console.log('ContractAt:', Contract, address);
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

    const Deployed = record(hre.Record);

    const Config = await ContractAt('Config', Deployed['Config']);

    const chains = ChainsData(hre.Chains);
    const polyId = chains.polyId;

    const remoteChains = Object.values(chains._raw).filter(chain => chain.polyId != polyId);

    for (let i = 0; i < remoteChains.length; i++) {
        const toPolyId = remoteChains[i].polyId;
        const salts = [polyId, toPolyId].sort();
        salts.push('ETH');
        const vaults = Deployed.Vaults;
        const tokenSymbols = Object.keys(vaults);
        for (let i = 0; i < tokenSymbols.length; i++) {
            const symbol = tokenSymbols[i];
            const vault = vaults[symbol];
            const args = [
                Config.address,
                vault
            ];
            console.log(`depoy Gateway-${symbol}-${chains._polyToName(toPolyId)}...`)
            const Gateway = await deployProxyMulti('Gateway', args, ['Gateways', toPolyId, symbol]);
            console.log(`Gateway-${symbol}-${chains._polyToName(toPolyId)}: ${Gateway.address}`)
            if (vault != await Config.boundVault(Gateway.address)) {
                console.log('bindVault:', vault, Gateway.address);
                await Config.bindVault(vault, Gateway.address);
            }
        }
    }
};

module.exports = func;
func.tags = ['Gateways'];