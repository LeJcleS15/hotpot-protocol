const record = require('../helps/record');

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

    const accounts = await ethers.getSigners();
    const deployAcc = accounts[0].address;
    console.log(deployAcc);


    const Deployed = record(hre.Record);

    const chainId = ethers.provider.network.chainId;
    const polyId = chainId;
    const Mocks = record(hre.Mock)
    const oracleMock = Mocks.SimplePriceOracle;

    await deploy('HotpotRouter', {
        from: deployAcc,
        args: [oracleMock, polyId.toAddress()],
        log: true,
        deterministicDeployment: false,
    });


    const router = await deployments.get('HotpotRouter');
    console.log('HotpotRouter', router.address)

    record(hre.Record, ['HotpotRouter'], router.address);
};

module.exports = func;
func.tags = ['Router'];