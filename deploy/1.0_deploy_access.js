const hre = require('hardhat');
const { ethers, upgrades } = hre;
const record = require('../helps/record');
const Access = "Access";
const _ = undefined;

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

module.exports = async function (hre) {
    const { getChainId } = hre;
    hre.chainId = await getChainId();

    const accounts = await ethers.getSigners();
    const deployAcc = accounts[0].address;
    const access = await deployProxy(Access, []);
    console.log("set balancer");
    const balancer = deployAcc;
    await access.setBalancer(balancer, true)
    console.log(await access.isBalancer(balancer))
    //await vaultConfig.setAccess(access.address);
    //console.log(await vaultConfig.access(), access.address, await vaultConfig.isKiller(deployAcc));  
}
module.exports.tags = [Access];
