const record = require('../helps/record');

const func = async function (hre) {
  const { deployments, ethers } = hre;
  const { deploy } = deployments;

  const accounts = await ethers.getSigners();
  const deployAcc = accounts[0].address;
  console.log(deployAcc);

  await deploy('FluxMock', {
    from: deployAcc,
    contract: 'ERC20Mock',
    args: ["FLUX", "FLUX", 18],
    log: true,
    deterministicDeployment: false,
  });

  const FLUX = await deployments.get('FluxMock');
  record(hre.Mock, ['FLUX'], FLUX.address);

  await deploy('ETHMock', {
    from: deployAcc,
    contract: 'ERC20Mock',
    args: ["ETH", "ETH", 18],
    log: true,
    deterministicDeployment: false,
  });

  const ERC20Mock = await deployments.get('ETHMock');
  record(hre.Mock, ['ERC20Mocks', 'ETH'], ERC20Mock.address);
};

module.exports = func;
func.tags = ['Mocks'];