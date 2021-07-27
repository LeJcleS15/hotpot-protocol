const record = require('../helps/record');
const { ethers } = require('hardhat');

const func = async function (hre) {
  const { deployments } = hre;
  const { deploy } = deployments;

  const accounts = await ethers.getSigners();
  const deployAcc = accounts[0].address;
  console.log(deployAcc);
  const chainId = ethers.provider.network.chainId;
  const polyId = chainId;
  const Mocks = record(hre.Mock)
  const ccmp = Mocks.PolyMock;

  await deploy('HotpotConfig', {
    from: deployAcc,
    args: [polyId, ccmp, Mocks.FLUX],
    log: true,
    deterministicDeployment: false,
  });

  const HotpotConfig = await deployments.get('HotpotConfig');
  record(hre.Record, ['HotpotConfig'], HotpotConfig.address);
};

module.exports = func;
func.tags = ['Config'];