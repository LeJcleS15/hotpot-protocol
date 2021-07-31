const { EthWeb3 } = require('./ethWeb3');
const HotpotGate = require('../artifacts/contracts/Hotpot.sol/HotpotGate.json');
const IHotpotConfig = require('../artifacts/contracts/HotpotConfig.sol/IHotpotConfig.json');
const IERC20 = require('../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json');
const Mocks = require('../mock.json');
const Record = require('../record.json');

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

const CrossTransfer = async (A, to, amount, useFlux = true) => {
    const token = await A.methods.token().call();
    const ierc20 = A.eweb3.ContractAt(IERC20.abi, token);
    await approve(ierc20, A.eweb3.address, A.address, amount);
    if (useFlux) {
        const configAddress = await A.methods.config().call();
        const iconfig = await A.eweb3.ContractAt(IHotpotConfig.abi, configAddress);
        const fluxAddress = await iconfig.methods.FLUX().call();
        const flux = A.eweb3.ContractAt(IERC20.abi, fluxAddress);
        await approve(flux, A.eweb3.address, A.address, amount);
    }
    const tx = A.methods.crossTransfer(to, amount, useFlux);
    return A.eweb3.sendTx(tx);
}

async function main() {
    const chainA = await newChain('chainA');
    const chainB = await newChain('chainB');
    const ContractAt = async (chain, dest, symbol) => {
        const chainId = chain.chainId;
        const appAddress = Record[chainId].HotpotGates[dest.chainId][symbol];
        console.log(appAddress, dest.chainId, chainId, Record[chainId])
        const contract = chain.ContractAt(HotpotGate.abi, appAddress);
        contract.chainId = chainId;
        contract.address = appAddress;
        return contract;
    }
    const connectApp = (A, B) => A.methods.bindGateway(B.chainId, B.address).send({ gas: 200000 });
    const gateA = await ContractAt(chainA, chainB, 'ETH');
    const gateB = await ContractAt(chainB, chainA, 'ETH');
    //await connectApp(gateA, gateB);
    //await connectApp(gateB, gateA);
    await CrossTransfer(gateA, chainB.address, '1000000000000000000000');
    console.log('Done');
    process.exit(0);
}

main();