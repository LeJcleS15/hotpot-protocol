const { expect } = require("chai");
const { ethers } = require('hardhat');
const Hotpot = require('./helps/Hotpot');

const testcasees = {
    tokens: [
        { symbol: 'USDT', decimals: 18, price: "1" },
        { symbol: 'BTC', decimals: 6, price: "40000" }
    ],
    vaults: [
        { symbol: 'USDT', amount: '10000' },
        { symbol: 'BTC', amount: "10" }
    ],
    crossTransfer: [
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
            amount: '2000',
            useFeeFlux: true
        },
        {
            symbol: 'BTC',
            amount: '2',
            useFeeFlux: true
        },
        {
            symbol: 'USDT',
            amount: '0.000000000000000001',
            useFeeFlux: true
        },
        {
            symbol: 'BTC',
            amount: '0.000001',
            useFeeFlux: true
        }
    ]
};

describe("Cross Test", function () {
    before(async function () {
        this.Chain1 = await Hotpot.New();
        this.Chain2 = await Hotpot.New();
        const tokens = testcasees.tokens;
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            await Hotpot.AddToken(token.symbol, token.decimals, token.price);
        }
        this.Status = async (chain, symbol, toPolyId, toAddress = undefined) => {
            const token = chain.tokens[symbol];
            const decimals = await token.decimals();
            const vault = chain.vaults[symbol];
            const gateway = chain.gateways[toPolyId][symbol];
            const pendingFlux = async accounts => {
                const results = {
                    total: ethers.constants.Zero,
                    details: []
                };
                for (let i = 0; i < accounts.length; i++) {
                    const account = accounts[i];
                    const _pendingFlux = await vault.pendingReward(account.address);
                    results.total = _pendingFlux.add(results.total);
                    results.details.push({
                        account: account,
                        share: await vault.balanceOf(account.address),
                        reward: await vault.rewards(account.address),
                        pendingFlux: _pendingFlux,
                        fluxBalance: await chain.flux.balanceOf(account.address),
                        balance: await token.balanceOf(account.address)
                    });
                }
                return results;
            }
            return {
                token: {
                    token,
                    decimals,
                    toBalance: toAddress && await token.balanceOf(toAddress),
                },
                vault: {
                    vault,
                    gateway,
                    fluxBalance: await chain.flux.balanceOf(vault.address),
                    balance: await token.balanceOf(vault.address),
                    gateDebt: await vault.gateDebt(gateway.address),
                    totalShare: await vault.totalSupply(),
                    totalToken: await vault.totalToken(),
                    pendingFlux: await pendingFlux([Hotpot.srcAccount, Hotpot.destAccount, Hotpot.lpAccount]),
                    reservedFeeFlux: await vault.reservedFeeFlux(),
                    reservedFee: await vault.reservedFee(),
                    rewardFluxPerShareStored: await vault.rewardFluxPerShareStored()
                }
            };
        }
    });

    it("1. Vault Deposit test", async function () {

        const depositVault = async (chain, toPolyId) => {
            const vaults = testcasees.vaults;
            //const accounts = [Hotpot.srcAccount, Hotpot.destAccount, Hotpot.lpAccount];
            for (let i = 0; i < vaults.length; i++) {
                const vault = vaults[i];
                const symbol = vault.symbol;
                const token = chain.tokens[symbol];
                const decimals = await token.decimals();
                const amount = ethers.utils.parseUnits(vault.amount, decimals);

                const before = await this.Status(chain, symbol, toPolyId);
                const accounts = before.vault.pendingFlux.details.map(detail => detail.account);
                for (let j = 0; j < accounts.length; j++) {
                    const account = accounts[j];
                    await chain.deposit(symbol, amount, account);
                }
                const after = await this.Status(chain, symbol, toPolyId);

                const totalAmount = amount.mul(accounts.length);
                expect(after.vault.balance).to.eq(totalAmount);
                for (let j = 0; j < after.vault.pendingFlux.details.length; j++) {
                    const beforeDetail = before.vault.pendingFlux.details[j];
                    const afterDetail = after.vault.pendingFlux.details[j];
                    const tokenAmount = await chain.shareToAmount(afterDetail.share, after.vault.totalShare, after.vault.totalToken);
                    expect(tokenAmount).to.eq(amount);
                    expect(afterDetail.balance).to.eq(beforeDetail.balance); // deposit will mint automatic
                }
            }
        }
        await depositVault(this.Chain1, this.Chain2.polyId);
        await depositVault(this.Chain2, this.Chain1.polyId);
    });

    it("2. CrossTransfer test", async function () {
        const srcChain = this.Chain1;
        const destChain = this.Chain2;

        for (let i = 0; i < testcasees.crossTransfer.length; i++) {
            const casei = testcasees.crossTransfer[i];
            const symbol = casei.symbol;

            const to = Hotpot.destAccount.address;

            const beforeSrc = await this.Status(srcChain, symbol, destChain.polyId);
            const beforeDest = await this.Status(destChain, symbol, srcChain.polyId, to);

            const amount = ethers.utils.parseUnits(casei.amount, beforeSrc.token.decimals);

            const tx = await Hotpot.CrossTransfer(srcChain, destChain, symbol, to, amount, casei.useFeeFlux);

            const receipt = await tx.wait(0);

            const afterSrc = await this.Status(srcChain, symbol, destChain.polyId);
            const afterDest = await this.Status(destChain, symbol, srcChain.polyId, to);

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
                expect(crossEvent.args.fee).to.equal(0, "fee shoule be 0 if useFeeFlux");
                const feeFlux = await srcChain.feeFlux(beforeSrc.vault.gateway, amount);
                expect(crossEvent.args.feeFlux).to.eq(feeFlux, "feeFlux different");
            }
            expect(afterSrc.vault.fluxBalance).to.eq(afterSrc.vault.gateDebt.debtFlux, "src chain debt should keep same");
            expect(afterDest.vault.pendingFlux.total.add(afterDest.vault.reservedFeeFlux)).to.equal(afterDest.vault.gateDebt.debtFlux.abs());

            expect(srcAmount.add(srcFee)).to.equal(amount);
            expect(afterDest.token.toBalance.sub(beforeDest.token.toBalance)).to.equal(destAmount);
            expect(afterSrc.vault.gateDebt.debt.sub(beforeSrc.vault.gateDebt.debt)).to.equal(amount);
            expect(beforeDest.vault.gateDebt.debt.sub(afterDest.vault.gateDebt.debt)).to.equal(destAmount.add(destFee));

            expect(afterSrc.vault.gateDebt.debtFlux.sub(beforeSrc.vault.gateDebt.debtFlux)).to.equal(crossEvent.args.feeFlux);
            expect(beforeDest.vault.gateDebt.debtFlux.sub(afterDest.vault.gateDebt.debtFlux)).to.equal(crossEvent.args.feeFlux);

            expect(beforeSrc.vault.gateDebt.debt.add(beforeDest.vault.gateDebt.debt)).to.equal(0);
            expect(beforeSrc.vault.gateDebt.debtFlux.add(beforeDest.vault.gateDebt.debtFlux)).to.equal(0);
            expect(afterSrc.vault.gateDebt.debt.add(afterDest.vault.gateDebt.debt)).to.equal(0);
            expect(afterSrc.vault.gateDebt.debtFlux.add(afterDest.vault.gateDebt.debtFlux)).to.equal(0);
        }
    });

    it("3. CrossRebalance test", async function () {
        const srcChain = this.Chain2;
        const destChain = this.Chain1;
        for (let i = 0; i < testcasees.crossTransfer.length; i++) {
            const casei = testcasees.crossTransfer[i];
            const symbol = casei.symbol;

            const to = Hotpot.destAccount.address;

            const beforeSrc = await this.Status(srcChain, symbol, destChain.polyId);
            const beforeDest = await this.Status(destChain, symbol, srcChain.polyId, to);

            const amount = beforeSrc.vault.gateDebt.debt.abs();
            const fluxAmount = beforeSrc.vault.gateDebt.debtFlux.abs();

            const tx = await srcChain.crossRebalance(destChain.polyId, symbol, to, amount, fluxAmount);

            const receipt = await tx.wait(0);

            const afterSrc = await this.Status(srcChain, symbol, destChain.polyId);
            const afterDest = await this.Status(destChain, symbol, srcChain.polyId, to);

            expect(beforeSrc.vault.totalShare).to.eq(afterSrc.vault.totalShare);
            expect(beforeSrc.vault.totalToken).to.eq(afterSrc.vault.totalToken);
            expect(beforeDest.vault.totalShare).to.eq(afterDest.vault.totalShare);
            expect(beforeDest.vault.totalToken).to.eq(afterDest.vault.totalToken);

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

            expect(afterDest.vault.pendingFlux.total.add(afterDest.vault.reservedFeeFlux)).to.equal(afterDest.vault.fluxBalance);
            expect(afterSrc.vault.pendingFlux.total.add(afterSrc.vault.reservedFeeFlux)).to.equal(afterSrc.vault.fluxBalance);

            const _fluxAmount = ethers.constants.Zero.sub(fluxAmount)
            expect(crossEvent.args.feeFlux).to.equal(_fluxAmount);

            expect(srcAmount.add(srcFee)).to.equal(amount);
            expect(afterDest.token.toBalance.sub(beforeDest.token.toBalance)).to.equal(destAmount);
            expect(afterSrc.vault.gateDebt.debt.sub(beforeSrc.vault.gateDebt.debt)).to.equal(amount);
            expect(beforeDest.vault.gateDebt.debt.sub(afterDest.vault.gateDebt.debt)).to.equal(destAmount.add(destFee));

            expect(afterSrc.vault.gateDebt.debtFlux.sub(beforeSrc.vault.gateDebt.debtFlux)).to.equal(fluxAmount);
            expect(beforeDest.vault.gateDebt.debtFlux.sub(afterDest.vault.gateDebt.debtFlux)).to.equal(fluxAmount);

            expect(beforeSrc.vault.gateDebt.debt.add(beforeDest.vault.gateDebt.debt)).to.equal(0);
            expect(beforeSrc.vault.gateDebt.debtFlux.add(beforeDest.vault.gateDebt.debtFlux)).to.equal(0);
            expect(afterSrc.vault.gateDebt.debt.add(afterDest.vault.gateDebt.debt)).to.equal(0);
            expect(afterSrc.vault.gateDebt.debtFlux.add(afterDest.vault.gateDebt.debtFlux)).to.equal(0);
        }
    });

    it("4. GetFluxReward test", async function () {
        const srcChain = this.Chain1;
        const destChain = this.Chain2;
        const vaults = testcasees.vaults;
        for (let i = 0; i < vaults.length; i++) {
            const vault = vaults[i];
            const symbol = vault.symbol;
            const beforeDest = await this.Status(destChain, symbol, srcChain.polyId);
            expect(beforeDest.vault.pendingFlux.total).to.gt(0);
            for (let j = 0; j < beforeDest.vault.pendingFlux.details.length; j++) {
                const beforeDetail = beforeDest.vault.pendingFlux.details[j];
                await destChain.harvestFlux(symbol, beforeDetail.account);
            }
            const afterDest = await this.Status(destChain, symbol, srcChain.polyId);

            expect(afterDest.vault.pendingFlux.total).to.eq(0);
            expect(afterDest.vault.reservedFeeFlux).to.eq(afterDest.vault.fluxBalance);
            expect(beforeDest.vault.reservedFeeFlux).to.eq(afterDest.vault.reservedFeeFlux);
            for (let j = 0; j < afterDest.vault.pendingFlux.details.length; j++) {
                const beforeDetail = beforeDest.vault.pendingFlux.details[j];
                const afterDetail = afterDest.vault.pendingFlux.details[j];
                expect(afterDetail.pendingFlux).to.eq(0);
                expect(afterDetail.fluxBalance.sub(beforeDetail.fluxBalance)).to.eq(beforeDetail.pendingFlux);
            }
        }
    });

    it("5. Get Reserved test", async function () {
        const srcChain = this.Chain1;
        const destChain = this.Chain2;
        const vaults = testcasees.vaults;
        const to = Hotpot.srcAccount;
        for (let i = 0; i < vaults.length; i++) {
            const vault = vaults[i];
            const symbol = vault.symbol;
            const beforeDest = await this.Status(destChain, symbol, srcChain.polyId);
            await destChain.withdrawReserved(symbol, to.address);
            const afterDest = await this.Status(destChain, symbol, srcChain.polyId);
            expect(afterDest.vault.reservedFee).to.eq(0);
            expect(afterDest.vault.reservedFeeFlux).to.eq(0);
            expect(afterDest.vault.pendingFlux.total).to.equal(afterDest.vault.fluxBalance);

            const beforeDetail = beforeDest.vault.pendingFlux.details.find(detail => detail.account.address == to.address);
            const afterDetail = afterDest.vault.pendingFlux.details.find(detail => detail.account.address == to.address);
            expect(afterDetail.fluxBalance.sub(beforeDetail.fluxBalance)).to.eq(beforeDest.vault.reservedFeeFlux);
            expect(afterDetail.balance.sub(beforeDetail.balance)).to.eq(beforeDest.vault.reservedFee);
        }
    });

    it("6. Vault withdraw/exit", async function () {
        const exitVault = async (srcChain, destChain) => {
            const vaults = testcasees.vaults;
            const to = Hotpot.srcAccount;
            for (let i = 0; i < vaults.length; i++) {
                const vault = vaults[i];
                const symbol = vault.symbol;
                const beforeDest = await this.Status(destChain, symbol, srcChain.polyId);
                for (let j = 0; j < beforeDest.vault.pendingFlux.details.length; j++) {
                    const beforeDetail = beforeDest.vault.pendingFlux.details[j];
                    await destChain.withdraw(symbol, beforeDetail.share, beforeDetail.account);
                }
                const afterDest = await this.Status(destChain, symbol, srcChain.polyId);
                expect(afterDest.vault.balance).to.eq(0);
                for (let j = 0; j < afterDest.vault.pendingFlux.details.length; j++) {
                    const beforeDetail = beforeDest.vault.pendingFlux.details[j];
                    const afterDetail = afterDest.vault.pendingFlux.details[j];
                    const tokenAmount = await destChain.shareToAmount(beforeDetail.share, beforeDest.vault.totalShare, beforeDest.vault.totalToken);
                    expect(afterDetail.balance.sub(beforeDetail.balance)).to.eq(tokenAmount);
                    expect(afterDetail.share).to.eq(0);
                }
            }
        }
        await exitVault(this.Chain1, this.Chain2);
        await exitVault(this.Chain2, this.Chain1);
    });
});