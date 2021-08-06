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

  await deploy('FluxMock', {
    from: deployAcc,
    contract: 'ERC20Mock',
    args: ["FLUX", "FLUX", 18],
    log: true,
    deterministicDeployment: false,
  });

  const FLUX = await deployments.get('FluxMock');
  const chain = ChainsData(hre.Chains);
  record(hre.Chains, ['FLUX'], FLUX.address, chain._name);

  await deploy('ETHMock', {
    from: deployAcc,
    contract: 'ERC20Mock',
    args: ["ETH", "ETH", 18],
    log: true,
    deterministicDeployment: false,
  });

  const ERC20Mock = await deployments.get('ETHMock');
  record(hre.Chains, ['TOKENS', 'ETH', 'token'], ERC20Mock.address, chain._name);
};

module.exports = func;
func.tags = ['Mocks'];