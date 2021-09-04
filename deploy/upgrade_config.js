const { ethers, upgrades } = require('hardhat');
const record = require('../helps/record');
const ContractKey = ["Config"];
const Contract = "Config";
const DeployedBytecode = require(`../artifacts/contracts/${Contract}.sol/${Contract}.json`).deployedBytecode;

function ContractAt(Contract, address) {
  return ethers.getSigners().then(
    account => ethers.getContractAt(
      Contract,
      address,
      account[0]
    )
  );
}

async function upgradeProxy(oldAddress, Contract) {
  const instance = await ContractAt(Contract, oldAddress)
  const newC = await ethers.getContractFactory(Contract);
  if (await implCheck(oldAddress, DeployedBytecode)) {
    console.log(`>> SameImpl ${Contract} at ${instance.address}`);
  } else {
    const upgraded = await upgrades.upgradeProxy(instance.address, newC, { unsafeAllowRenames: true });
    console.log(`>> Upgraded ${Contract} at ${upgraded.address}`);
  }
  return instance;
}

async function getProxyImplementation(address) {
  const proxyAdmin = await upgrades.admin.getInstance();
  return proxyAdmin.callStatic.getProxyImplementation(address);
}

const CodeCache = {}
async function implCheck(address, newImplCode) {
  const impl = await getProxyImplementation(address);
  if (!CodeCache[impl]) {
    CodeCache[impl] = await ethers.provider.getCode(impl);
  }
  return newImplCode == CodeCache[impl];
}


module.exports = async function (hre) {
  const { getChainId } = hre;
  hre.chainId = await getChainId();
  const accounts = await ethers.getSigners();
  const deployAcc = accounts[0].address;
  console.log(deployAcc, hre.chainId);

  const Deployed = record(hre.Record);
  const oldAddress = ContractKey.reduce((r, key) => r[key], Deployed);
  {
    const Config = oldAddress;
    const oldC = await ContractAt(Contract, Config)
    //const newC = await upgradeProxy(Config, Contract);
    //await oldC.setRouter(Deployed.RouterV2);
    //console.log("CHAINID:", Number(await oldC.getChainID()))
    console.log(await oldC.isRouter(Deployed.Router), await oldC.isRouter(Deployed.RouterV2), await oldC.oracle())
    //console.log(Deployed.ExtCaller, await oldC.extCaller())
  }
}
module.exports.tags = ["upgradeConfig"];
