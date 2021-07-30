const record = require('../helps/record');
const polyIds = require('../PolyIds.json');

async function deployProxyMulti(Contract, inputs, path) {
    const deployed = record(hre.Record)._path(path);
    if (deployed && process.argv.includes('--reset')) return ContractAt(Contract, deployed);
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

    const Deployed = record(hre.Record);

    const HotpotConfig = await ContractAt('HotpotConfig', Deployed['HotpotConfig']);

    const chainId = ethers.provider.network.chainId;
    const polyId = chainId;
    const remotePolyIds = polyIds.filter(id => id != polyId);

    for (let i = 0; i < remotePolyIds.length; i++) {
        const toPolyId = remotePolyIds[i];
        const salts = [polyId, toPolyId].sort();
        salts.push('ETH');
        const vault = Deployed._path(['Vaults', 'ETH']);
        const args = [
            HotpotConfig.address,
            vault
        ];
        const HotpotGate = await deployProxyMulti('HotpotGate', args, ['HotpotGates', toPolyId, 'ETH']);
        console.log('HotpotGate', toPolyId, HotpotGate.address)
        await HotpotConfig.bindVault(vault, HotpotGate.address);
    }
};

module.exports = func;
func.tags = ['Gateways'];