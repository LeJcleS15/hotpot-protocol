const record = require('../helps/record');

const func = async function (hre) {
  const { deployments,ethers } = hre;
  const { deploy } = deployments;

  const accounts = await ethers.getSigners();
  const deployAcc = accounts[0].address;
  console.log(deployAcc);

  const Deployed = record(hre.Record);
  const Mocks = record(hre.Mock);
  const args = [
    Deployed['HotpotConfig'],
    Mocks['ERC20Mocks']['ETH']
  ]

  await deploy('Vault', {
    from: deployAcc,
    args,
    log: true,
    deterministicDeployment: false,
  });

  const vault = await deployments.get('Vault');
  console.log('Vault', vault.address)
  record(hre.Record, ['Vaults', 'ETH'], vault.address);
};

module.exports = func;
func.tags = ['Vaults'];