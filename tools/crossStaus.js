const { EthWeb3 } = require('./ethWeb3');
const Gateway = require('../artifacts/contracts/Gateway.sol/Gateway.json');


const NETENV = 'testnet';
// NETENV: testnet,mainnet
// net: heco,bsc,ok
const Chains = [
    {
        net: 'heco', // 源链
        tx: '0x0f72dd474932c1afc3d29bc186f1a609bd587f514fa8e229b5448b710093a85c' // 发起hash
    },
    {
        net: 'bsc',  // 目标链
        tx: '0x726fe49cfc74d9c0ca15b033f496d7117437313d2710d79d43a2457b0359b6f1' // 二次确认hash
    }
]

const networks = require('../networks.json')[NETENV];

// const PRIKEY = '1111111111111111111111111111111111111111111111111111111111111111';
async function newChain(name) {
    const network = networks[name];
    const chain = new EthWeb3(network.url);
    const chainId = await chain.web3.eth.getChainId();
    console.log(name, chainId, network.chainId);
    return chain;
}

const CrossTransferTopic = '0x34f724ddc8a8cef32aa7b72109150fe6f1e80cabdc83b19f90605a103d877a9e';
const CrossTransferTypes = ['uint256', 'address', 'uint256', 'uint256', 'int256'];
const CrossTransferWithDataTopic = '0xa9b6efdb260eb3884044ffa6b8d3fd27a0775f552c93586245268b1623b44af0';
const CrossTransferWithDataTypes = ['uint256', 'address', 'uint256', 'uint256', 'int256', 'address', 'bytes'];
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
    const destTx = await destChain.web3.eth.getTransaction(Chains[toIndex].tx);
    const fromReceipt = await srcChain.web3.eth.getTransactionReceipt(Chains[fromIndex].tx);

    // poly event
    // const PolyLog = fromReceipt.logs.find(log => [PolyTopic].includes(log.topics[0]));
    // const srcInput = PolyLog.data.slice(-374, -54);
    // const srcR = srcChain.web3.eth.abi.decodeParameters(['uint256', 'address', 'uint256', 'uint256', 'int256'], srcInput);

    let srcData;
    const CrossLog = fromReceipt.logs.find(log => [CrossTransferTopic, CrossTransferWithDataTopic].includes(log.topics[0]));
    const isCrossData = Number(CrossLog.topics[1]) > 1e18;
    let srcLogs;
    if (isCrossData) {
        const CrossTransferWithDataABI = Gateway.abi.find(item => item.type == 'event' && item.name == 'CrossTransferWithData').inputs;
        srcLogs = srcChain.web3.eth.abi.decodeLog(CrossTransferWithDataABI, CrossLog.data, CrossLog.topics.slice(1));
        // crossId, to, metaAmount, metaFee, _feeFlux, from, data
        srcData = srcChain.web3.eth.abi.encodeParameters(CrossTransferWithDataTypes, [
            srcLogs.crossId,
            srcLogs.to,
            srcLogs.amount,
            srcLogs.fee,
            srcLogs.feeFlux,
            srcLogs.from,
            srcLogs.extData,
        ]);
    }
    else {
        const CrossTransferABI = Gateway.abi.find(item => item.type == 'event' && item.name == 'CrossTransfer').inputs;
        srcLogs = srcChain.web3.eth.abi.decodeLog(CrossTransferABI, CrossLog.data, CrossLog.topics.slice(1));
        srcData = srcChain.web3.eth.abi.encodeParameters(CrossTransferTypes, [
            srcLogs.crossId,
            srcLogs.to,
            srcLogs.amount,
            srcLogs.fee,
            srcLogs.feeFlux
        ]);
    }
    srcInput = srcData.slice(2);
    console.log(srcLogs)

    const destInput = destTx.input;
    const destParams = destChain.web3.eth.abi.decodeParameters(['bytes', 'address', 'uint64'], destInput.slice(10));

    // console.log(srcData)
    // console.log(destParams[0])

    try {
        const destR = isCrossData ? destChain.web3.eth.abi.decodeParameters(CrossTransferWithDataTypes, destParams[0]) : destChain.web3.eth.abi.decodeParameters(CrossTransferTypes, destParams[0]);
        const keys = ['crossId', 'to', 'amount', 'fee', 'feeFlux', 'from', 'extData'];
        console.log('destR:', keys.reduce((t, name, i) => {
            (destR[i] && (t[name] = destR[i]), t);
            return t;
        }, {}));
    } catch (e) {
        console.log(e)
    }

    const destHash = destChain.web3.utils.keccak256(destParams[0]);
    const srcHash = srcChain.web3.utils.keccak256(`0x${srcInput}`);
    console.log('----Dest:', destHash)
    console.log('----Src: ', srcHash);

    const destContract = destTx.to;

    console.log('dest gateway:', destContract);

    const gateway = ContractAt(destChain, Gateway.abi, destContract);

    const confirms = await gateway.methods.crossConfirms(srcHash).call(); // 1 hotpot 2 poly 3:hotpot+poly
    const status = await gateway.methods.existedIds(srcLogs.crossId).call();
    const pendingLength = await gateway.methods.pendingLength().call();
    console.log("confrim:", confirms.toString('hex'), "status:", status.toString(), "pending:", pendingLength.toString())
    for (let i = 0; i < pendingLength; i++) {
        const pendingi = await gateway.methods.pending(i).call();
        console.log("pending", i, destChain.web3.eth.abi.decodeParameters(CrossTransferTypes, pendingi));
    }

}

main();