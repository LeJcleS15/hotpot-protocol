const hre = require('hardhat');
const { ethers, upgrades } = hre;
const record = require('../helps/record');
const Access = "Access";
const _ = undefined;

async function deployProxy(Contract, inputs) {
    const path = [Contract]
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

function ContractAt(Contract, address) {
    console.log('ContractAt:', Contract, address);
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

    console.log('chainId:', hre.chainId, deployAcc)
    const access = await deployProxy(Access, []);
    const balancer = deployAcc;
    if (!await access.isBalancer(balancer)) {
        console.log("set balancer:", balancer);
        await access.setBalancer(balancer, true)
        console.log(await access.isBalancer(balancer))
    }
    //await vaultConfig.setAccess(access.address);
    //console.log(await vaultConfig.access(), access.address, await vaultConfig.isKiller(deployAcc));  
}
module.exports.tags = [Access];
