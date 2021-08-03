const { EthWeb3 } = require('./ethWeb3');
const ethers = require('ethers');
const Router = require('../artifacts/contracts/Router.sol/Router.json');
const Vault = require('../artifacts/contracts/Vault.sol/Vault.json');
const Gateway = require('../artifacts/contracts/Gateway.sol/Gateway.json');
const IConfig = require('../artifacts/contracts/interfaces/IConfig.sol/IConfig.json');
const IERC20 = require('../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json');
const Record = require('../record_local.json');

const truffleConfig = require('../truffle-config');
async function newChain(name) {
    const network = truffleConfig.networks[name];
    const ws = `ws://${network.host}:${network.port}`;
    const chain = new EthWeb3(ws, 1e9);
    const chainId = await chain.web3.eth.getChainId();
    const prikeys = require(`/tmp/${chainId}.json`).private_keys;
    const prikey = Object.values(prikeys)[0];
    chain.addPrivateKey(prikey);
    chain.chainId = chainId;
    return chain;
}

const bn = (numStr, decimals = 18) => ethers.utils.parseUnits(numStr, decimals);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const max256 = '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';

const approve = async (ierc20, from, to, amount) => {
    const allowance = await ierc20.methods.allowance(from, to).call();
    if (allowance < amount) {
        const tx = ierc20.methods.approve(to, max256);
        await ierc20.eweb3.sendTx(tx);
        return ierc20.methods.allowance(from, to).call();
    }
    return allowance;
}

const CrossTransfer = async (A, to, amount, maxFlux) => {
    const token = await A.methods.token().call();
    const ierc20 = A.eweb3.ContractAt(IERC20.abi, token);
    await approve(ierc20, A.eweb3.address, A.vault.address, amount);
    if (maxFlux > 0) {
        const iconfig = await A.iconfig;
        const fluxAddress = await iconfig.methods.FLUX().call();
        const flux = A.eweb3.ContractAt(IERC20.abi, fluxAddress);
        await approve(flux, A.eweb3.address, A.vault.address, maxFlux);
    }
    const tx = A.router.methods.crossTransfer(A.address, to, amount, maxFlux.toString());
    return A.eweb3.sendTx(tx);
}

function ContractAt(chain, abi, address) {
    const contract = chain.ContractAt(abi, address);
    contract.chainId = chain.chainId;
    contract.address = address;
    return contract;
}

const RouterAt = chain => {
    const chainId = chain.chainId;
    const appAddress = Record[chainId].Router;
    console.log(appAddress, chainId)
    return ContractAt(chain, Router.abi, appAddress);
}

const IConfigAt = chain => {
    const chainId = chain.chainId;
    const appAddress = Record[chainId].Config;
    console.log(appAddress, chainId)
    return ContractAt(chain, IConfig.abi, appAddress);
}
const VaultAt = (chain, symbol) => {
    const chainId = chain.chainId;
    const appAddress = Record[chainId].Vaults[symbol];
    console.log(appAddress, chainId)
    return ContractAt(chain, Vault.abi, appAddress);
}

const GateAt = (chain, dest, symbol) => {
    const chainId = chain.chainId;
    const appAddress = Record[chainId].Gateways[dest.chainId][symbol];
    console.log(appAddress, dest.chainId, chainId, Record[chainId])
    const contract = ContractAt(chain, Gateway.abi, appAddress);
    contract.router = RouterAt(chain);
    contract.iconfig = IConfigAt(chain);
    contract.vault = VaultAt(chain, symbol);
    return contract;
}

function getArgv(flag) {
    const i = process.argv.indexOf(`-${flag}`);
    return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
    const from = getArgv('from') || 'chainA';
    const to = getArgv('to') || 'chainB';
    const chainA = await newChain(from);
    const chainB = await newChain(to);

    //const connectApp = (A, B) => A.methods.bindGateway(B.chainId, B.address).send({ gas: 200000 });
    const token = getArgv('flux') || 'ETH';
    const gateA = GateAt(chainA, chainB, token);
    const gateB = GateAt(chainB, chainA, token);

    //await connectApp(gateA, gateB);
    //await connectApp(gateB, gateA);
    const feeFlux = getArgv('flux')
    const tx = await CrossTransfer(gateA, chainB.address, bn('1'), feeFlux ? bn(feeFlux) : 0);
    console.log('Done', tx.gasUsed);
    process.exit(0);
}

main();