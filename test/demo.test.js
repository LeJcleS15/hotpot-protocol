const { expect } = require("chai");
const { ethers, upgrades } = require('hardhat');


Number.prototype.toAddress = function () {
    const hexStr = ethers.BigNumber.from(Number(this)).toHexString().slice(2);
    const pad = 40 - hexStr.length;
    return `0x${'0'.repeat(pad)}${hexStr}`;
}
String.prototype.toAddress = Number.prototype.toAddress;

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

class Hotpot {
    static polyMock;
    static oracle;
    static chains = [];

    constructor() {
        this.polyId = Hotpot.chains.length + 1;
    }

    async deploy() {
        this.oracle = await deploy('SimplePriceOracle');

        this.access = await deployProxy('Access', []);
        console.log('deploy router')
        this.router = await deploy('Router', [this.oracle.address, this.polyId.toAddress()]);
        console.log('deploy Flux')
        this.flux = await deploy('ERC20Mock', ['Flux Mock', 'Flux', 18]);
        this.config = await deployProxy('Config', [Hotpot.polyMock.address, this.flux.address, this.access.address, this.oracle.address, this.router.address]);
        this.tokens = {};
        this.vaults = {};
        this.gateways = {};
    }

    async addToken(symbol, decimals = 18) {
        console.log('addToken:', this.tokens)
        if (this.tokens[symbol]) throw "token existed";
        this.tokens[symbol] = await deploy('ERC20Mock', [symbol, symbol, decimals]);
        await this.addVault(symbol);
    }

    async addVault(symbol) {
        const token = this.tokens[symbol];
        const args = [
            this.config.address,
            token.address,
            `Hotpot Vault ${symbol.toUpperCase()}`,
            `hot${symbol.toUpperCase()}`
        ]
        this.vaults[symbol] = await deployProxy('Vault', args, ['Vaults', symbol]);
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
    }

    async bindGateway(symbol, remotePolyId, remoteGateway) {
        const gateway = this.gateways[remotePolyId][symbol];
        await gateway.bindGateway(remotePolyId, remoteGateway);
    }

    static async New(price = 1) {
        const hotpot = new Hotpot();
        if (!Hotpot.polyMock) {
            Hotpot.polyMock = await deploy('PolyCall');
        }
        await hotpot.deploy();
        Hotpot.chains.push(hotpot);
        return hotpot;
    }

    static async AddToken(symbol, decimals = 18) {
        for (let i = 0; i < Hotpot.chains.length; i++) {
            const chain = Hotpot.chains[i];
            await chain.addToken(symbol, decimals - i);
        }
        const binds = {};
        for (let i = 0; i < Hotpot.chains.length; i++) {
            const chain = Hotpot.chains[i];
            const remoteChains = Hotpot.chains.filter(rchain => chain.polyId != rchain.polyId);
            for (let j = 0; j < remoteChains.length; j++) {
                const rchain = remoteChains[j];
                await chain.addGateway(rchain.polyId, symbol)
                if (binds[rchain.polyId]) {
                    await rchain.bindGateway(symbol, chain.polyId, chain.gateways[rchain.polyId][symbol].address);
                    await chain.bindGateway(symbol, rchain.polyId, rchain.gateways[chain.polyId][symbol].address);
                }
                binds[chain.polyId] = rchain.polyId;
            }
        }
    }
}



describe("Greeter", function () {
    it("Should return the new greeting once it's changed", async function () {
        const hp1 = await Hotpot.New();
        const hp2 = await Hotpot.New();
        await Hotpot.AddToken("USDT", 18);
    });
});