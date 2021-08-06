const record = require('../helps/record');
const ChainsData = require('../helps/chains');
const hre = require('hardhat');
const { ethers, upgrades } = hre;

const _ = undefined;

async function deployProxy(Contract, inputs) {
  const factory = (await ethers.getContractFactory(
    Contract,
    (await ethers.getSigners())[0]
  ));
  const proxyed = await upgrades.deployProxy(factory, inputs);
  await proxyed.deployed();
  console.log(`>> Deployed ${Contract} at ${proxyed.address}`);
  record(hre.Record, [Contract], proxyed.address, hre.chainId);
  return proxyed;
}

function ContractAt(Contract, address) {
  return ethers.getSigners().then(
    account => ethers.getContractAt(
      Contract,
      address,
      account[0]
    )
  );
}

const func = async function (hre) {
  const accounts = await ethers.getSigners();
  const deployAcc = accounts[0].address;
  console.log(deployAcc);
  const { getChainId } = hre;
  hre.chainId = await getChainId();

  const Deployed = record(hre.Record);
  const access = Deployed.Access;
  const router = Deployed.Router;

  const chains = ChainsData(hre.Chains);
  //const tokens = ChainsData(hre.Tokens);
  const FLUX = chains.FLUX;

  const ccmp = chains.PolyCCMP;
  const oracle = chains.Oracle;
  const Config = await deployProxy('Config', [ccmp, FLUX, access, oracle, router]);
};

module.exports = func;
func.tags = ['Config'];