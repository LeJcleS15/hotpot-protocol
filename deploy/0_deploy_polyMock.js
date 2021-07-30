const record = require('../helps/record');

const func = async function (hre) {
  const { deployments, ethers } = hre;
  const { deploy } = deployments;

  const accounts = await ethers.getSigners();
  const deployAcc = accounts[0].address;
  console.log(deployAcc);

  await deploy('PolyMock', {
    from: deployAcc,
    contract: 'PolyMock',
    args: [],
    log: true,
    deterministicDeployment: false,
  });

  const polyMock = await deployments.get('PolyMock');
  console.log('PolyMock', polyMock.address)
  record(hre.Mock, ['PolyMock'], polyMock.address);
};

module.exports = func;
func.tags = ['Mocks'];