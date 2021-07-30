const record = require('../helps/record');

const func = async function (hre) {
    const { deployments, ethers } = hre;
    const { deploy } = deployments;

    const accounts = await ethers.getSigners();
    const deployAcc = accounts[0].address;
    console.log(deployAcc);

    await deploy('SimplePriceOracle', {
        from: deployAcc,
        contract: 'SimplePriceOracle',
        args: [],
        log: true,
        deterministicDeployment: false,
    });

    const oracleMock = await deployments.get('SimplePriceOracle');
    record(hre.Mock, ['SimplePriceOracle'], oracleMock.address);
};

module.exports = func;
func.tags = ['Mocks'];