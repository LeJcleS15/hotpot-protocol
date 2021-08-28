const { EthWeb3 } = require('./ethWeb3');
const Gateway = require('../artifacts/contracts/Gateway.sol/Gateway.json');


const NETENV = 'mainnet';
const Chains = [
    {
        net: 'heco',
        tx: '0x1a0920467a079da09e69a5388efd4b3772d513d4258393b4c6507eace8dd1f62'
    },
    {
        net: 'ok',
        tx: '0x8976606D64B268102CEFB4DE8F1C8B4A334FD2C81F37C468B5CFEBED8E11CBD2'
    }
]

const networks = require('../networks.json')[NETENV];

async function newChain(name) {
    const network = networks[name];
    const chain = new EthWeb3(network.url, 1e9);
    const chainId = await chain.web3.eth.getChainId();
    console.log(name, chainId, network.chainId);
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
    const destTx = await destChain.web3.eth.getTransaction(Chains[toIndex].tx);
    const fromReceipt = await srcChain.web3.eth.getTransactionReceipt(Chains[fromIndex].tx);
    const PolyLog = fromReceipt.logs.find(log => log.topics[0] == PolyTopic);

    const srcInput = PolyLog.data.slice(-374, -54);
    const srcR = srcChain.web3.eth.abi.decodeParameters(['uint256', 'address', 'uint256', 'uint256', 'int256'], srcInput);

    const destInput = destTx.input;
    const destParams = destChain.web3.eth.abi.decodeParameters(['bytes', 'address', 'uint64'], destInput.slice(10));

    const destR = destChain.web3.eth.abi.decodeParameters(['uint256', 'address', 'uint256', 'uint256', 'int256'], destParams[0]);

    const destHash = destChain.web3.utils.keccak256(destParams[0]);
    const srcHash = srcChain.web3.utils.keccak256(`0x${srcInput}`);
    console.log('----Dest:', destHash)
    console.log('----Src: ', srcHash);
    console.log('destR:', destR);
    console.log('srcR: ', srcR);

    const destContract = destTx.to;

    console.log('dest gateway:', destContract);

    const gateway = ContractAt(destChain, Gateway.abi, destContract);

    const confirms = await gateway.methods.crossConfirms(destHash).call();
    const exist = await gateway.methods.existedIds(destR[0]).call();
    const pendingLength = await gateway.methods.pendingLength().call();
    console.log(confirms.toString('hex'), exist.toString(), pendingLength.toString())
    for (let i = 0; i < pendingLength; i++) {
        const pendingi = await gateway.methods.pending(i).call();
        console.log(pendingi);
    }

}

main();