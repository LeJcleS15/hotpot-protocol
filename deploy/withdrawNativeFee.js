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

    const chains = ChainsData(hre.Chains);

    const router = await ContractAt('Router', Deployed.Router);
    const relayer = '0x809814106B453dea026585BA2b9df52498A369Eb';
    await router.setFeeCollector(relayer);

};

module.exports = func;
func.tags = ['withdrawNativeFee'];