const record = require('../helps/record');
const ChainsData = require('../helps/chains');


Number.prototype.toAddress = function () {
    const hexStr = ethers.BigNumber.from(Number(this)).toHexString().slice(2);
    const pad = 40 - hexStr.length;
    return `0x${'0'.repeat(pad)}${hexStr}`;
}
String.prototype.toAddress = Number.prototype.toAddress;

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
    const { deployments, ethers } = hre;
    const { deploy } = deployments;
    const { getChainId } = hre;
    hre.chainId = await getChainId();

    const accounts = await ethers.getSigners();
    const deployAcc = accounts[0].address;
    console.log(deployAcc);

    const Deployed = record(hre.Record);
    //const tokens = ChainsData(hre.Tokens);

    const balancer = '0x6F431c9039216DCc5E65c00BCC7FD1C8e1048440';
    const Access = await ContractAt('Access', Deployed.Access);
    if (!await Access.isBalancer(balancer)) {
        console.log('setBalancer:', balancer)
        await Access.setBalancer(balancer, true);
    }
    if (!await Access.isHotpoter(balancer)) {
        console.log('setHotpoter:', balancer)
        await Access.setHotpoter(balancer, true);
    }
    console.log('isBalancer:', await Access.isBalancer(balancer));
    console.log('isHotpoter:', await Access.isHotpoter(balancer));
};

module.exports = func;
func.tags = ['Balancer'];