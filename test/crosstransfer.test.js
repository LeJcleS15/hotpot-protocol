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
        this.Chain1 = await Hotpot.New();
        this.Chain2 = await Hotpot.New();
        await Hotpot.AddToken("USDT", 18, 1);
        await Hotpot.AddToken("BTC", 6, 40000);
    })
    it("CrossTransfer test", async function () {
        const srcChain = this.Chain1;
        const destChain = this.Chain2;
        for (let i = 0; i < testcasees.length; i++) {
            const casei = testcasees[i];
            const symbol = casei.symbol;
            const srcToken = srcChain.tokens[symbol];
            const srcDecimals = await srcToken.decimals();
            const srcFlux = srcChain.fluxl
            const srcVault = srcChain.vaults[symbol];
            const srcGateway = srcChain.gateways[destChain.polyId][symbol];
            const amount = ethers.utils.parseUnits(casei.amount, srcDecimals);
            const to = Hotpot.destAccount.address;
            const destToken = destChain.tokens[symbol];
            const destFlux = destChain.flux;
            const destVault = destChain.vaults[symbol];
            const destGateway = destChain.gateways[srcChain.polyId][symbol];

            const beforeBalance = await destToken.balanceOf(to);
            const beforeSrcDebt = await srcVault.gateDebt(srcGateway.address);
            const beforeDestDebt = await destVault.gateDebt(destGateway.address);

            const tx = await Hotpot.CrossTransfer(srcChain, destChain, symbol, to, amount, casei.useFeeFlux);

            const receipt = await tx.wait(0);
            const afterBalance = await destToken.balanceOf(to);
            const afterSrcDebt = await srcVault.gateDebt(srcGateway.address);
            const afterDestDebt = await destVault.gateDebt(destGateway.address);

            const gateway = await ethers.getContractFactory('Gateway');
            var iface = gateway.interface;
            const CrossTransferSig = iface.getEventTopic('CrossTransfer');

            const crossLog = receipt.logs.find(log => log.topics[0] == CrossTransferSig)
            const crossEvent = iface.parseLog(crossLog);
            const srcAmount = await srcChain.toNative(symbol, crossEvent.args.amount);
            const srcFee = await srcChain.toNative(symbol, crossEvent.args.fee);
            const destAmount = await destChain.toNative(symbol, crossEvent.args.amount);
            const destFee = await destChain.toNative(symbol, crossEvent.args.fee);
            if (casei.useFeeFlux) {
                expect(crossEvent.args.fee).to.equal(0);
                expect(crossEvent.args.feeFlux).to.gt(0);
            }
            expect(srcAmount.add(srcFee)).to.equal(amount);
            expect(afterBalance.sub(beforeBalance)).to.equal(destAmount);
            expect(afterSrcDebt.debt.sub(beforeSrcDebt.debt)).to.equal(amount);
            expect(beforeDestDebt.debt.sub(afterDestDebt.debt)).to.equal(destAmount.add(destFee));

            expect(afterSrcDebt.debtFlux.sub(beforeSrcDebt.debtFlux)).to.equal(crossEvent.args.feeFlux);
            expect(beforeDestDebt.debtFlux.sub(afterDestDebt.debtFlux)).to.equal(crossEvent.args.feeFlux);

            expect(beforeSrcDebt.debt.add(beforeDestDebt.debt)).to.equal(0);
            expect(beforeSrcDebt.debtFlux.add(beforeDestDebt.debtFlux)).to.equal(0);
            expect(afterSrcDebt.debt.add(afterDestDebt.debt)).to.equal(0);
            expect(afterSrcDebt.debtFlux.add(afterDestDebt.debtFlux)).to.equal(0);
        }
    });

    it("CrossRebalance test", async function () {
        const srcChain = this.Chain2;
        const destChain = this.Chain1;
        for (let i = 0; i < testcasees.length; i++) {
            const casei = testcasees[i];
            const symbol = casei.symbol;
            const srcToken = srcChain.tokens[symbol];
            const srcDecimals = await srcToken.decimals();
            const srcFlux = srcChain.flux;
            const srcVault = srcChain.vaults[symbol];
            const srcGateway = srcChain.gateways[destChain.polyId][symbol];
            const to = Hotpot.destAccount.address;
            const destToken = destChain.tokens[symbol];
            const destFlux = destChain.flux;
            const destVault = destChain.vaults[symbol];
            const destGateway = destChain.gateways[srcChain.polyId][symbol];

            const beforeBalance = await destToken.balanceOf(to);
            const beforeSrcDebt = await srcVault.gateDebt(srcGateway.address);
            const beforeDestDebt = await destVault.gateDebt(destGateway.address);

            const amount = beforeSrcDebt.debt.abs();
            const fluxAmount = beforeSrcDebt.debtFlux.abs();

            const tx = await srcChain.crossRebalance(destChain.polyId, symbol, to, amount, fluxAmount);

            const receipt = await tx.wait(0);
            const afterBalance = await destToken.balanceOf(to);
            const afterSrcDebt = await srcVault.gateDebt(srcGateway.address);
            const afterDestDebt = await destVault.gateDebt(destGateway.address);

            const gateway = await ethers.getContractFactory('Gateway');
            var iface = gateway.interface;
            const OnCrossTransferSig = iface.getEventTopic('OnCrossTransfer');

            const crossLog = receipt.logs.find(log => log.topics[0] == OnCrossTransferSig)
            const crossEvent = iface.parseLog(crossLog);
            const srcAmount = await srcChain.toNative(symbol, crossEvent.args.amount);
            const srcFee = await srcChain.toNative(symbol, crossEvent.args.fee);
            const destAmount = await destChain.toNative(symbol, crossEvent.args.amount);
            const destFee = await destChain.toNative(symbol, crossEvent.args.fee);

            expect(crossEvent.args.fee).to.equal(0);

            const _fluxAmount = ethers.constants.Zero.sub(fluxAmount)
            expect(crossEvent.args.feeFlux).to.equal(_fluxAmount);

            expect(srcAmount.add(srcFee)).to.equal(amount);
            expect(afterBalance.sub(beforeBalance)).to.equal(destAmount);
            expect(afterSrcDebt.debt.sub(beforeSrcDebt.debt)).to.equal(amount);
            expect(beforeDestDebt.debt.sub(afterDestDebt.debt)).to.equal(destAmount.add(destFee));

            expect(afterSrcDebt.debtFlux.sub(beforeSrcDebt.debtFlux)).to.equal(fluxAmount);
            expect(beforeDestDebt.debtFlux.sub(afterDestDebt.debtFlux)).to.equal(fluxAmount);

            expect(beforeSrcDebt.debt.add(beforeDestDebt.debt)).to.equal(0);
            expect(beforeSrcDebt.debtFlux.add(beforeDestDebt.debtFlux)).to.equal(0);
            expect(afterSrcDebt.debt.add(afterDestDebt.debt)).to.equal(0);
            expect(afterSrcDebt.debtFlux.add(afterDestDebt.debtFlux)).to.equal(0);
        }
    });
});