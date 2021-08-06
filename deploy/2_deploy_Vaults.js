const record = require('../helps/record');
const ChainsData = require('../helps/chains');
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
  if (deployed && !process.argv.includes('--reset')) return ContractAt(Contract, deployed);
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
  const { getChainId } = hre;
  hre.chainId = await getChainId();

  const accounts = await ethers.getSigners();
  const deployAcc = accounts[0].address;
  console.log(deployAcc);

  const Deployed = record(hre.Record);
  const TOKENS = ChainsData(hre.Chains).TOKENS;

  const TokenSymbols = Object.keys(TOKENS);
  for (let i = 0; i < TokenSymbols.length; i++) {
    const symbol = TokenSymbols[i];
    const token = TOKENS[symbol];

    const args = [
      Deployed['Config'],
      token.token,
      `Hotpot Vault ${symbol.toUpperCase()}`,
      `hot${symbol.toUpperCase()}`
    ]
    console.log('Vaults:', symbol);
    const vault = await deployProxyMulti('Vault', args, ['Vaults', symbol]);
    console.log(`Hotpot Vault ${symbol.toUpperCase()}`, vault.address);
    if (token.ftoken) {
      const ftoken = await vault.ftoken();
      if (ftoken.toLowerCase() != token.ftoken.toLowerCase()) {
        console.log('setFtoken:', token.ftoken);
        await vault.setFToken(token.ftoken);
      }
    }
  }

};

module.exports = func;
func.tags = ['Vaults'];