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

  await deploy('PolyMock', {
    from: deployAcc,
    contract: 'PolyMock',
    args: [],
    log: true,
    deterministicDeployment: false,
  });
  const polyMock = await deployments.get('PolyMock');
  console.log('PolyMock', polyMock.address);
  const chain = ChainsData(hre.Chains);
  record(hre.Chains, ['PolyCCMP'], polyMock.address, chain._name);
};

module.exports = func;
func.tags = ['Mocks'];