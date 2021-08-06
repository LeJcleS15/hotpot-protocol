
Number.prototype.toAddress = function () {
    const hexStr = ethers.BigNumber.from(Number(this)).toHexString().slice(2);
    const pad = 40 - hexStr.length;
    return `0x${'0'.repeat(pad)}${hexStr}`;
}
String.prototype.toAddress = Number.prototype.toAddress;

const bn = ethers.BigNumber.from

async function deployProxy(Contract, inputs) {
    const factory = (await ethers.getContractFactory(
        Contract,
        (await ethers.getSigners())[0]
    ));
    const proxyed = await upgrades.deployProxy(factory, inputs);
    await proxyed.deployed();
    console.log(`>> DeployedProxy ${Contract} at ${proxyed.address}`);
    return proxyed;
}

async function deploy(Contract, inputs = []) {
    const factory = (await ethers.getContractFactory(
        Contract,
        (await ethers.getSigners())[0]
    ));
    const contract = await factory.deploy(...inputs);
    await contract.deployed();
    console.log(`>> Deployed ${Contract} at ${contract.address}`);
    return contract;
}

const PRICE = price => ethers.utils.parseUnits(String(price), 18);

class Hotpot {
    static polyMock;
    static oracle;
    static chains = [];
    static accounts;
    static srcAccount;
    static destAccount;

    constructor() {
        this.polyId = Hotpot.chains.length + 1;
    }

    async deploy() {
        this.oracle = await deploy('SimplePriceOracle');
        this.access = await deployProxy('Access', []);
        this.router = await deploy('Router', [this.oracle.address, this.polyId.toAddress()]);
        this.flux = await deploy('ERC20Mock', ['Flux Mock', 'Flux', 18]);
        this.config = await deployProxy('Config', [Hotpot.polyMock.address, this.flux.address, this.access.address, this.oracle.address, this.router.address]);
        this.tokens = {};
        this.vaults = {};
        this.gateways = {};
        this.lens = await deploy('HotpotLens', []);
        await this.oracle.setPrice(this.flux.address, PRICE(0.5))
    }

    async init(price, gas, gasPrice) {
        this.nativePrice = price;
        this.gas = gas;
        this.gasPrice = gasPrice;
        await this.oracle.setPrice(this.polyId.toAddress(), price);
    }

    async setRemoteGas(destChain) {
        await this.oracle.setPrice(destChain.polyId.toAddress(), destChain.nativePrice);
        await this.router.setGas([destChain.polyId], [destChain.gas], [destChain.gasPrice]);
    }

    async addToken(symbol, decimals, price) {
        if (this.tokens[symbol]) throw "token existed";
        const token = await deploy('ERC20Mock', [symbol, symbol, decimals]);
        this.tokens[symbol] = token;
        await this.addVault(symbol);
        if (price) await this.oracle.setPrice(token.address, price);
        return token;
    }

    async addVault(symbol) {
        const token = this.tokens[symbol];
        const args = [
            this.config.address,
            token.address,
            `Hotpot Vault ${symbol.toUpperCase()}`,
            `hot${symbol.toUpperCase()}`
        ]
        const vault = await deployProxy('Vault', args, ['Vaults', symbol]);
        this.vaults[symbol] = vault;
        return vault;
    }

    async addGateway(remotePolyId, symbol) {
        const vault = this.vaults[symbol];
        const args = [
            this.config.address,
            vault.address
        ];
        if (!this.gateways[remotePolyId]) this.gateways[remotePolyId] = {}
        const gateway = await deployProxy('Gateway', args);
        await this.config.bindVault(vault.address, gateway.address);
        this.gateways[remotePolyId][symbol] = gateway;
        return gateway;
    }

    async bindGateway(symbol, remoteChain) {
        const remotePolyId = remoteChain.polyId;
        const remoteGateway = remoteChain.gateways[this.polyId][symbol];
        const gateway = this.gateways[remotePolyId][symbol];
        await gateway.bindGateway(remotePolyId, remoteGateway.address);
    }

    async crossTransfer(toPolyId, symbol, to, amount, useFeeFlux) {
        const srcRouer = this.router;
        const srcToken = this.tokens[symbol];
        const srcGateway = this.gateways[toPolyId][symbol];
        const srcVault = this.vaults[symbol];
        const srcFlux = this.flux;
        const srcAccount = Hotpot.srcAccount;

        await srcToken.mint(srcAccount.address, amount);
        await srcToken.approve(srcVault.address, amount);
        let maxFeeFlux = 0;
        if (useFeeFlux) {
            maxFeeFlux = await this.feeFlux(srcGateway, amount);
            await srcFlux.mint(srcAccount.address, maxFeeFlux);
            await srcFlux.approve(srcVault.address, maxFeeFlux);
        }
        return srcRouer.crossTransfer(srcGateway.address, to, amount, maxFeeFlux);
    }

    async deposit(symbol, amount) {
        const token = this.tokens[symbol];
        const vault = this.vaults[symbol];
        const account = Hotpot.srcAccount;
        await token.mint(account.address, amount);
        await token.approve(vault.address, amount);
        await vault.deposit(amount);
    }

    async toMeta(symbol, amount) {
        const token = this.tokens[symbol];
        const decimals = await token.decimals();
        return amount.mul(bn(10).pow(18 - decimals));
    }

    async toNative(symbol, amount) {
        const token = this.tokens[symbol];
        const decimals = await token.decimals();
        return amount.div(bn(10).pow(18 - decimals));
    }

    async feeFlux(gateway, amount) {
        const fee = await gateway.fee();
        const feeToken = amount.mul(fee).div(10000);
        const token = await gateway.token();
        return this.config.feeFlux(token, feeToken);
    }

    static async New(price = PRICE(1)) {
        const hotpot = new Hotpot();
        if (!Hotpot.polyMock) {
            Hotpot.polyMock = await deploy('PolyCall');
            Hotpot.accounts = await ethers.getSigners();
            Hotpot.srcAccount = this.accounts[0];
            Hotpot.destAccount = this.accounts[1];
        }
        await hotpot.deploy();
        await hotpot.init(price, 0, 0);
        for (let i = 0; i < Hotpot.chains.length; i++) {
            const chain = Hotpot.chains[i];
            await chain.setRemoteGas(hotpot);
            await hotpot.setRemoteGas(chain);
        }
        Hotpot.chains.push(hotpot);
        return hotpot;
    }

    static async AddToken(symbol, decimals, price) {
        for (let i = 0; i < Hotpot.chains.length; i++) {
            const chain = Hotpot.chains[i];
            await chain.addToken(symbol, decimals, price);
        }
        const deployed = {};
        for (let i = 0; i < Hotpot.chains.length; i++) {
            const chain = Hotpot.chains[i];
            const remoteChains = Hotpot.chains.filter(rchain => chain.polyId != rchain.polyId);
            for (let j = 0; j < remoteChains.length; j++) {
                const rchain = remoteChains[j];
                await chain.addGateway(rchain.polyId, symbol)
                if (deployed[rchain.polyId]) {
                    await rchain.bindGateway(symbol, chain);
                    await chain.bindGateway(symbol, rchain);
                }
            }
            deployed[chain.polyId] = true;
        }
    }

    static async CrossTransfer(srcChain, destChain, symbol, to, amount, useFeeFlux) {
        await destChain.deposit(symbol, amount);
        return srcChain.crossTransfer(destChain.polyId, symbol, to, amount, useFeeFlux);
    }

}

module.exports = Hotpot;