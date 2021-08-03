const record = require('../helps/record');
const ChainsData = require('../helps/chains');

const func = async function (hre) {
    const { deployments, ethers } = hre;
    const { deploy } = deployments;
    const { getChainId } = hre;
    hre.chainId = await getChainId();

    const accounts = await ethers.getSigners();
    const deployAcc = accounts[0].address;
    console.log(deployAcc);

    if (hre.netenv != 'local') throw "not local network"

    await deploy('SimplePriceOracle', {
        from: deployAcc,
        contract: 'SimplePriceOracle',
        args: [],
        log: true,
        deterministicDeployment: false,
    });

    const oracleMock = await deployments.get('SimplePriceOracle');
    const chain = ChainsData(hre.Chains);
    record(hre.Chains, ['Oracle'], oracleMock.address, chain._name);
};

module.exports = func;
func.tags = ['Mocks'];