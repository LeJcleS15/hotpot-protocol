const record = require('../helps/record');
const gateways = require('../gateway.json');

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
    const Mocks = record(hre.Mock);

    const tokenMock = await ContractAt("ERC20Mock", Mocks['ERC20Mocks']['ETH']);

    const HotpotConfig = await ContractAt('HotpotConfig', Deployed['HotpotConfig']);

    const chainId = ethers.provider.network.chainId;
    const polyId = chainId;
    const gates = gateways.filter(id => id != polyId);

    for (let i = 0; i < gates.length; i++) {
        const toPolyId = gates[i];
        const salts = [polyId, toPolyId].sort();
        salts.push('ETH');
        const args = [
            Deployed['HotpotConfig'],
            Deployed['Vaults']['ETH'],
            `Hotpot ETH`,
            `hpETH`
        ]

        await deploy('HotpotGate', {
            from: deployAcc,
            args,
            log: true,
            deterministicDeployment: false,
        });

        const HotpotGate = await deployments.get('HotpotGate');
        console.log('HotpotGate', toPolyId, HotpotGate.address)
        record(hre.Record, ['HotpotGates', toPolyId, 'ETH'], HotpotGate.address);

        const vault = Deployed.Vaults['ETH']
        await HotpotConfig.bindVault(vault, HotpotGate.address);
    }
};

module.exports = func;
func.tags = ['Gateways'];