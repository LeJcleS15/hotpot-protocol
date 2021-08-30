const record = require('../helps/record');
const ChainsData = require('../helps/chains');

const _ = undefined;

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

const func = async function (hre) {
    const { deployments, ethers } = hre;
    const { deploy } = deployments;
    const { getChainId } = hre;
    hre.chainId = await getChainId();

    const accounts = await ethers.getSigners();
    const deployAcc = accounts[0].address;
    console.log(deployAcc);

    //const chains = ChainsData(hre.Chains);
    //const tokens = ChainsData(hre.Tokens);

    const Deployed = record(hre.Record);
    const testnet = hre.network.name.endsWith('_test');
    const Contract = testnet ? 'ExtCallerTestnet' : 'ExtCaller';
    await deploy(Contract, {
        from: deployAcc,
        args: [Deployed.Config],
        log: true,
        deterministicDeployment: false,
    });
    const ExtCaller = await deployments.get(Contract);
    console.log('ExtCaller', ExtCaller.address)

    const Config = await ContractAt('Config', Deployed['Config']);
    await Config.setCaller(ExtCaller.address);
    record(hre.Record, ['ExtCaller'], ExtCaller.address, hre.chainId);
};

module.exports = func;
func.tags = ['ExtCaller'];