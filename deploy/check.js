const record = require('../helps/record');
const ChainsData = require('../helps/chains');
//const { ethers } = require('ethers');

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

const address = C => C.address;
const bigToAddress = bign => {
    hexStr = bign.toHexString();
    if (hexStr.startsWith('0x')) hexStr = hexStr.slice(2);
    return `0x${'0'.repeat(40 - hexStr.length)}${hexStr}`;
}

async function getBorrowLimit(vaultC) {
    const ftokenC = await ContractAt('IFToken', await vaultC.ftoken());
    if (ftokenC.address == ethers.constants.AddressZero) return;
    const fluxAppC = await ContractAt('IFluxApp', await ftokenC.app());
    const borrowLimit = await fluxAppC.getBorrowLimit(ftokenC.address, vaultC.address);
    return borrowLimit;
}

async function getVaultMeta(vaultC) {
    const token = await vaultC.token();
    const tokenC = await ContractAt('ERC20', token);
    const config = await vaultC.config();
    const configC = await ContractAt('Config', config);
    console.log('feePrice...')
    const feePrice = await configC.feePrice(token);
    console.log('feePrice:', feePrice)
    await getBorrowLimit(vaultC);
}

async function getGatewayMeta(gatewayC) {
    const config = await gatewayC.config();
    const configC = await ContractAt('Config', config);
    const routerC = await ContractAt('Router', await configC.router());
    const remotePolyId = await gatewayC.remotePolyId();

    const nativeId = await routerC.wnative();
    const oracle = await routerC.oracle();
    const oracleC = await ContractAt('IPriceOracle', oracle);

    console.log('nativePrice...', nativeId)
    const nativePrice = await oracleC.getPriceMan(nativeId);
    console.log('nativePrice:', nativePrice)
    console.log('remotePolyIdPrice...', remotePolyId)
    const remotePolyIdPrice = await oracleC.getPriceMan(bigToAddress(remotePolyId));
    console.log('remotePolyIdPrice:', remotePolyIdPrice)

    console.log('getFeeNative...', remotePolyId)
    const feeNative = await routerC.getFeeNative(remotePolyId);
    console.log('feeNative:', feeNative)
    const flux = await configC.FLUX();
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
    const chains = ChainsData(hre.Chains);
    const oracle = await ContractAt('IPriceOracle', chains.Oracle);
    const config = await ContractAt('Config', Deployed.Config);

    for (const gateways of Object.values(Deployed.Gateways)) {
        const gateway = Object.values(gateways)[0];
        const gatewayC = await ContractAt('Gateway', gateway);
        await getGatewayMeta(gatewayC);
    }
    for (const vault of Object.values(Deployed.Vaults)) {
        const vaultC = await ContractAt('Vault', vault);
        await getVaultMeta(vaultC);
    }

    console.log('-----------------------------')
    return;
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