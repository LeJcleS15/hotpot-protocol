const { expect } = require("chai");
const { ethers, upgrades } = require('hardhat');
const Hotpot = require('./helps/Hotpot');



const testcasees = [
    {
        symbol: 'USDT',
        amount: '1000',
        useFeeFlux: false
    },
    {
        symbol: 'BTC',
        amount: '1',
        useFeeFlux: false
    },
    {
        symbol: 'USDT',
        amount: '1000',
        useFeeFlux: true
    },
    {
        symbol: 'BTC',
        amount: '1',
        useFeeFlux: true
    },
]

describe("Greeter", function () {
    before(async function () {
        this.srcChain = await Hotpot.New();
        this.destChain = await Hotpot.New();
        await Hotpot.AddToken("USDT", 18, 1);
        await Hotpot.AddToken("BTC", 6, 40000);
    })
    it("CrossTransfer test", async function () {
        for (let i = 0; i < testcasees.length; i++) {
            const casei = testcasees[i];
            const symbol = casei.symbol;
            const srcToken = this.srcChain.tokens[symbol];
            const srcDecimals = await srcToken.decimals();
            const amount = ethers.utils.parseUnits(casei.amount, srcDecimals);
            const to = Hotpot.destAccount.address;
            const destToken = this.destChain.tokens[symbol];
            const beforeBalance = await destToken.balanceOf(to);
            const tx = await Hotpot.CrossTransfer(this.srcChain, this.destChain, symbol, to, amount, casei.useFeeFlux);
            const afterBalance = await destToken.balanceOf(to);
            const receipt = await tx.wait(0);

            const gateway = await ethers.getContractFactory('Gateway');
            var iface = gateway.interface;
            const CrossTransferSig = iface.getEventTopic('CrossTransfer');
            //const OnCrossTransferSig = iface.getEventTopic('OnCrossTransfer');

            const crossLog = receipt.logs.find(log => log.topics[0] == CrossTransferSig)
            //const onCrossEvent = receipt.logs.find(log => log.topics[0] == OnCrossTransferSig)
            const crossEvent = iface.parseLog(crossLog);
            const srcAmount = await this.srcChain.toNative(symbol, crossEvent.args.amount);
            const srcFee = await this.srcChain.toNative(symbol, crossEvent.args.fee);
            const destAmount = await this.destChain.toNative(symbol, crossEvent.args.amount);
            if (casei.useFeeFlux) {
                expect(crossEvent.args.fee).to.equal(0);
                expect(crossEvent.args.feeFlux).to.gt(0);
            }
            expect(srcAmount.add(srcFee)).to.equal(amount);
            expect(afterBalance.sub(beforeBalance)).to.equal(destAmount);
        }
    });
});