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

    const balancer = '0x99d29a9fb9493cf9e1bb99c556b87f7d495c2152';
    const hotpoter = balancer;
    const compromiser = '0x383d66BbE5864653953c4E4121AB8b7531E75E04';
    const Access = await ContractAt('Access', Deployed.Access);
    if (!await Access.isBalancer(balancer)) {
        console.log('setBalancer:', balancer)
        await Access.setBalancer(balancer, true);
    }
    if (!await Access.isHotpoter(hotpoter)) {
        console.log('setHotpoter:', hotpoter)
        await Access.setHotpoter(hotpoter, true);
    }
    if (!await Access.isCompromiser(compromiser)) {
        console.log('setCompromiser:', compromiser)
        await Access.setCompromiser(compromiser, true);
    }
    console.log('isBalancer:', await Access.isBalancer(balancer));
    console.log('isHotpoter:', await Access.isHotpoter(hotpoter));
    console.log('isCompromiser:', await Access.isCompromiser(compromiser));
};

module.exports = func;
func.tags = ['Balancer'];