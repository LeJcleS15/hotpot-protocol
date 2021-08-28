const { EthWeb3 } = require('./ethWeb3');
const Gateway = require('../artifacts/contracts/Gateway.sol/Gateway.json');

const NETENV = 'mainnet';
const SYMBOL = 'USDT';
const Chains = [
    {
        net: 'ok',
        tx: '0xe6065ff4844cbd26ba1fb0e014e5c73f4085fde8ec16e29d0bb794d72b28065c'
    },
    {
        net: 'heco'
    }
]

const networks = require('../networks.json')[NETENV];
const chainFile = `chains_${NETENV}.json`;
const recordFile = `record_${NETENV}.json`;
const chainConfig = require('../helps/chains');
const records = require('../helps/record');


async function newChain(name) {
    name = name.toLowerCase();
    name = name == 'oec' ? 'ok' : name;
    const network = networks[name];
    const chain = new EthWeb3(network.url);
    const chainId = await chain.web3.eth.getChainId();
    chain.config = chainConfig(chainFile, chainId);
    chain.record = records(recordFile, undefined, undefined, chainId);
    chain.chainId = chainId;
    chain.polyId = chain.config.polyId;
    console.log(name, chainId, network.chainId, chain.polyId);
    return chain;
}

const PolyTopic = '0x6ad3bf15c1988bc04bc153490cab16db8efb9a3990215bf1c64ea6e28be88483';

const ContractAt = (chain, abi, address) => {
    const contract = chain.ContractAt(abi, address);
    contract.address = address;
    return contract;
}

async function main() {
    const fromIndex = 0;
    const toIndex = 1;
    const srcChain = await newChain(Chains[fromIndex].net);
    const destChain = await newChain(Chains[toIndex].net);

    const fromReceipt = await srcChain.web3.eth.getTransactionReceipt(Chains[fromIndex].tx);
    const PolyLog = fromReceipt.logs.find(log => log.topics[0] == PolyTopic);
    console.log(PolyLog);
    const srcInput = PolyLog.data.slice(-374, -54);
    const srcR = srcChain.web3.eth.abi.decodeParameters(['uint256', 'address', 'uint256', 'uint256', 'int256'], srcInput);

    const srcHash = srcChain.web3.utils.keccak256(`0x${srcInput}`);
    console.log('----Src: ', srcHash);
    console.log('srcR: ', srcR);
    console.log('src:', Number(srcR[2]) / 1e18, Number(srcR[3]) / 1e18, Number(srcR[4]) / 1e18)

    const destGatewayAddress = destChain.record._path(['Gateways', srcChain.polyId, SYMBOL])
    console.log('destGateway:', destGatewayAddress);

    const gateway = ContractAt(destChain, Gateway.abi, destGatewayAddress);

    const confirms = await gateway.methods.crossConfirms(srcHash).call();
    console.log('confirms:', srcHash, confirms.toString());
    const exist = await gateway.methods.existedIds(srcR[0]).call();
    console.log('existStaus:', exist);
    const pendingLength = await gateway.methods.pendingLength().call();
    console.log('pendingLength:', pendingLength.toString())
    for (let i = 0; i < pendingLength; i++) {
        const pendingi = await gateway.methods.pending(i).call();
        console.log(pendingi);
    }

    const srcGateway = srcChain.record._path(['Gateways', destChain.polyId, SYMBOL]);
    console.log('srcGateway:', srcGateway);
    if (confirms == 1) {
        console.log('need confirm')
        const tx = await gateway.methods.onCrossTransferByHotpoter(`0x${srcInput}`, srcGateway, srcChain.polyId);
        //const r = await gateway.eweb3.sendTx(tx);
        //console.log('second confirm:', r);
    }

}

main();