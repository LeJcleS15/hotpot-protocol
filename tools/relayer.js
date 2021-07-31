const { EthWeb3 } = require('./ethWeb3');
const PolyJson = require('../artifacts/contracts/mock/poly.sol/PolyMock.json');
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
    return chain;
}

const PolyABI = PolyJson.abi;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    const chainA = await newChain('chainA');
    const chainB = await newChain('chainB');
    const ContractAt = async chain => {
        const chainId = await chain.web3.eth.getChainId();
        const polyAddress = Mocks[chainId].PolyMock;
        const contract = chain.ContractAt(PolyABI, polyAddress);
        contract.chainId = chainId;
        contract.address = polyAddress;
        console.log(chainId, polyAddress)
        return contract;
    }
    const polyA = await ContractAt(chainA);
    const polyB = await ContractAt(chainB);

    const relayer = (polyA, polyB, flag) => polyA.events.CrossChain({ fromBlock: 0 }, async (err, event) => {
        if (err) throw `${flag}:${err}`;
        console.log(`------${flag}------`);
        const txHash = event.transactionHash;
        if (await polyB.methods.txExisted(txHash).call()) return;
        const argvs = [txHash];
        Object.keys(event.returnValues).filter(key => !isNaN(Number(key))).forEach(i => argvs[Number(i) + 1] = event.returnValues[i]);
        const gas = await polyB.methods.crossHandler(...argvs).estimateGas();
        const tx = await polyB.methods.crossHandler(...argvs).send({ gas });
        console.log('gas:', gas, tx.gasUsed)
    })
    relayer(polyA, polyB, "A=>B")
    relayer(polyB, polyA, "B=>A")
    for (; ;) {
        //await chainA.web3.eth.getPastLogs()
        //const eventsA = await getPastEvents(chainA.web3, polyA);
        //const eventsB = await getPastEvents(chainB.web3, polyB);
        //console.log(eventsA);
        //console.log(eventsB);
        console.log('---')
        await sleep(1000);
    }
}

main();