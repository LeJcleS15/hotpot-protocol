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

const REQUIRE = async (cond, err) => cond || console.log(err);

const func = async function (hre) {
    const { deployments, ethers } = hre;
    const { deploy } = deployments;
    const { getChainId } = hre;
    hre.chainId = await getChainId();

    const accounts = await ethers.getSigners();
    const deployAcc = accounts[0].address;
    console.log(deployAcc);

    const Deployed = record(hre.Record);
    const chains = ChainsData(hre.Chains);
    const oracle = await ContractAt('IPriceOracle', chains.Oracle);
    const config = await ContractAt('Config', Deployed.Config);

    REQUIRE(oracle.address == await config.oracle(), 'oracle');

    const keys = Object.keys(chains.TOKENS);//.filter(key => key == 'BTC');

    for (let ti = 0; ti < keys.length; ti++) {
        const symbol = keys[ti];
        const vault = Deployed.Vaults[symbol];
        const vaultC = await ContractAt('Vault', vault);

        const gates = Object.values(Deployed['Gateways']).map(gates => gates[symbol]);

        for (let i = 0; i < gates.length; i++) {
            const gate = await ContractAt('Gateway', gates[i]);
            const vConfig = await vaultC.config();
            const gConfig = await gate.config();
            REQUIRE(vConfig == gConfig && gConfig == config.address, `check ${i} ${symbol} g:${gConfig} v:${vConfig} c:${config.address}`);
        }
    }
};

module.exports = func;
func.tags = ['Check'];