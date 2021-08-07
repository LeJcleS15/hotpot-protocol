const { ethers, upgrades } = require('hardhat');
const record = require('../helps/record');
const ContractKey = ["Gateways"];
const Contract = "Gateway";

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
  const upgraded = await upgrades.upgradeProxy(instance.address, newC);
  console.log(`>> Upgraded ${Contract} at ${upgraded.address}`);
  return upgraded;
}

/*
export interface ValidationOptions {
  unsafeAllowCustomTypes?: boolean;
  unsafeAllowLinkedLibraries?: boolean;
  unsafeAllowRenames?: boolean;
  unsafeAllow?: ValidationError['kind'][];
  kind?: ProxyDeployment['kind'];
}
*/


module.exports = async function (hre) {
  const { getChainId } = hre;
  hre.chainId = await getChainId();
  const accounts = await ethers.getSigners();
  const deployAcc = accounts[0].address;
  console.log(deployAcc);
  /*
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  await deploy('FluxTokenMock', {
    from: deployer,
    log: true,
    deterministicDeployment: false,
  });

  const fluxMock = await deployments.get('FluxTokenMock');

  console.log(fluxMock.address)
  */

  const Deployed = record(hre.Record);
  const oldAddress = ContractKey.reduce((r, key) => r[key], Deployed);

  const gateways = Object.values(oldAddress).reduce((t, x) => [...t, ...Object.values(x)], []);
  for (let i = 0; i < gateways.length; i++) {
    const gateway = gateways[i];
    const oldC = await ContractAt(Contract, gateway)
    const newC = await upgradeProxy(gateway, Contract, { unsafeAllowRenames: false });
    console.log(i, await oldC.config())
  }
  //const newC = await upgradeProxy(oldAddress, Contract);
  //const newC = await ContractAt(Contract, oldAddress)
  //const flux = await newC.FLUX();
  //console.log("flux:", flux);
  //await newC.withdrawFluxAdmin();
  //await newC.setSupplierPoint(40000);
  //await newC.setOracle("0xa3D7D6f54D8f6A4931424bD687DbFAB42Bf48Faf");
  //const newC = await ContractAt(Contract, oldAddress)
  //await newC.fix();
}
module.exports.tags = ["upgradeGateways"];
