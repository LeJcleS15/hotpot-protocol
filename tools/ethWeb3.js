const Web3 = require('web3');

class EthWeb3 {
    web3; address;
    constructor(url, prikey = process.env.PRIKEY) {
        this.web3 = new Web3(url);
        if (prikey)
            this.addPrivateKey(prikey);
    }
    ContractAt(abi, address) {
        const contract = new this.web3.eth.Contract(abi, address, { from: this.address });
        contract.handleRevert = true; // https://web3js.readthedocs.io/en/v1.3.4/web3-eth-contract.html#handlerevert
        contract.eweb3 = this;
        return contract;
    }
    ContractDeploy(abi, code, _arguments) {
        return this.ContractAt(abi).deploy({
            data: code,
            arguments: _arguments
        });
    }
    async sendTx(tx, options = {}) {
        if (!options.gas) {
            options.gas = await tx.estimateGas();
        }
        if (!options.gasPrice) {
            options.gasPrice = await this.web3.eth.getGasPrice();
        }
        return tx.send(options);
    }
    addPrivateKey(prikey) {
        //console.log(prikey, typeof prikey);
        const acc = this.web3.eth.accounts.privateKeyToAccount(prikey);
        this.web3.eth.accounts.wallet.add(acc);
        this.address = acc.address;
    }
}


module.exports = { EthWeb3 }