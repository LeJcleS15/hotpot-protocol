const record = require('../helps/record');
const hre = require('hardhat');
const { ethers, upgrades } = hre;

function ContractAt(Contract, address) {
  return ethers.getSigners().then(
    account => ethers.getContractAt(
      Contract,
      address,
      account[0]
    )
  );
}

async function deployProxyMulti(Contract, inputs, path) {
  const deployed = record(hre.Record)._path(path);
  if (deployed && process.argv.includes('--reset')) return ContractAt(Contract, deployed);
  const factory = (await ethers.getContractFactory(
    Contract,
    (await ethers.getSigners())[0]
  ));
  const proxyed = await upgrades.deployProxy(factory, inputs);
  await proxyed.deployed();
  console.log(`>> Deployed ${Contract} at ${proxyed.address}`);
  record(hre.Record, path, proxyed.address);
  return proxyed;
}

const func = async function (hre) {
  const { deployments, ethers } = hre;
  const { deploy } = deployments;

  const accounts = await ethers.getSigners();
  const deployAcc = accounts[0].address;
  console.log(deployAcc);

  const Deployed = record(hre.Record);
  const Mocks = record(hre.Mock);
  const args = [
    Deployed['HotpotConfig'],
    Mocks['ERC20Mocks']['ETH'],
    `Vault ETH`,
    `vETH`
  ]

  const vault = await deployProxyMulti('Vault', args, ['Vaults', 'ETH'])
  console.log('Vault', vault.address)
};

module.exports = func;
func.tags = ['Vaults'];