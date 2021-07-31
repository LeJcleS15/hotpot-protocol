const record = require('../helps/record');
const hre = require('hardhat');
const { ethers, upgrades } = hre;


async function deployProxy(Contract, inputs) {
  const factory = (await ethers.getContractFactory(
    Contract,
    (await ethers.getSigners())[0]
  ));
  const proxyed = await upgrades.deployProxy(factory, inputs);
  await proxyed.deployed();
  console.log(`>> Deployed ${Contract} at ${proxyed.address}`);
  record(hre.Record, [Contract], proxyed.address);
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

  const Deployed = record(hre.Record);
  const access = Deployed.Access;
  const router = Deployed.HotpotRouter;

  const Mocks = record(hre.Mock)
  const ccmp = Mocks.PolyMock;
  const oracleMock = Mocks.SimplePriceOracle;
  const HotpotConfig = await deployProxy('HotpotConfig', [ccmp, Mocks.FLUX, access, oracleMock, router]);
};

module.exports = func;
func.tags = ['Config'];