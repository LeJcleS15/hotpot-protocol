const { ethers } = require('hardhat');
const record = require('../helps/record');
const ChainsData = require('../helps/chains');

function ContractAt(Contract, address) {
    return ethers.getSigners().then(
        account => ethers.getContractAt(
            Contract,
            address,
            account[0]
        )
    );
}

Number.prototype.toAddress = function () {
    const hexStr = ethers.BigNumber.from(Number(this)).toHexString().slice(2);
    const pad = 40 - hexStr.length;
    return `0x${'0'.repeat(pad)}${hexStr}`;
}
String.prototype.toAddress = Number.prototype.toAddress;

const func = async function (hre) {
    const { deployments, ethers } = hre;
    const { deploy } = deployments;
    const { getChainId } = hre;
    hre.chainId = await getChainId();

    const accounts = await ethers.getSigners();
    const deployAcc = accounts[0].address;
    console.log(deployAcc);

    const chains = ChainsData(hre.Chains);
    const symbol = process.env.TOKEN;
    const toPolyId = chains._raw[process.env.TO].polyId;

    const mockERC20 = await ContractAt('ERC20Mock', chains.TOKENS[symbol].token)
    const decimals = await mockERC20.decimals();
    const amount = ethers.utils.parseUnits("1", decimals);

    const Deployed = record(hre.Record);
    const gate = Deployed.Gateways[toPolyId][symbol];
    const vault = Deployed.Vaults[symbol];
    const router = await ContractAt('Router', Deployed.Router);

    const allowance = await mockERC20.allowance(deployAcc, vault);
    if (allowance < amount)
        await mockERC20.approve(vault, ethers.constants.MaxUint256);
    await router.crossTransfer(gate, deployAcc, amount, 0);

};

module.exports = func;
func.tags = ['Cross'];