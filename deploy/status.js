const record = require('../helps/record');
const ChainsData = require('../helps/chains');

function ContractAt(Contract, address) {
    return ethers.getSigners().then(
        account => ethers.getContractAt(
            Contract,
            address,
            account[0]
        )
    );
}


Number.prototype.toAddress = function () {
    const hexStr = ethers.BigNumber.from(Number(this)).toHexString().slice(2);
    const pad = 40 - hexStr.length;
    return `0x${'0'.repeat(pad)}${hexStr}`;
}
String.prototype.toAddress = Number.prototype.toAddress;

const func = async function (hre) {
    const { deployments, ethers } = hre;
    const { deploy } = deployments;
    const { getChainId } = hre;
    hre.chainId = await getChainId();

    const accounts = await ethers.getSigners();
    const deployAcc = accounts[0].address;
    console.log(deployAcc);

    const Deployed = record(hre.Record);
    const chains = ChainsData(hre.Chains);
    const oracle = await ContractAt('IPriceOracle', chains.Oracle);
    const keys = Object.keys(chains.TOKENS).filter(key => key == 'ETH');

    const FLUX = await ContractAt('ERC20Mock', chains.FLUX);

    for (let ti = 0; ti < keys.length; ti++) {
        const symbol = keys[ti];
        const mockERC20 = await ContractAt('ERC20Mock', chains.TOKENS[symbol].token)
        const decimals = await mockERC20.decimals();

        const price = await oracle.getPriceMan(mockERC20.address);
        console.log(`${symbol}-price:`, ethers.utils.formatUnits(price, 18));

        const vault = Deployed.Vaults[symbol];
        const vaultC = await ContractAt('Vault', vault);
        const ftoken = await vaultC.ftoken();
        if (ftoken != ethers.constants.AddressZero) {
            const IFToken = await ContractAt('IFToken', ftoken);
            const app = await IFToken.app();
            const IFluxApp = await ContractAt('IFluxApp', app);
            const borrowLimit = await IFluxApp.getBorrowLimit(ftoken, vault);
            const fbalance = await mockERC20.balanceOf(ftoken);
            console.log('ftoken:',
                ethers.utils.formatUnits(fbalance, decimals),
                ethers.utils.formatUnits(borrowLimit.limit, decimals),
                ethers.utils.formatUnits(borrowLimit.cash, decimals))

            //await IFToken.connect(vault).callStatic.borrow('20000000000000000000');
        }

        const users = ['0x0818b8938FCD0a253ccDeDE9eC417277D3ca11E3', '0x054af6202f2419295c554500f0ED1dc2F9e9569A'];
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const pendingReward = await vaultC.pendingReward(user);
            console.log('pendingReward:', i, pendingReward.toString());
        }
        const reservedFeeFlux = await vaultC.reservedFeeFlux();
        console.log('reservedFeeFlux:', reservedFeeFlux.toString());

        const totalToken = await vaultC.totalToken();
        console.log('totalToken:', totalToken.toString())


        const fluxVaultBalance = await FLUX.balanceOf(vault);
        const vaultBalance = await mockERC20.balanceOf(vaultC.address);
        console.log(`Vault ${symbol} balance:`, ethers.utils.formatUnits(vaultBalance, decimals));
        console.log('flux vault balance:', ethers.utils.formatUnits(fluxVaultBalance, 18), fluxVaultBalance.toString());
        const balance = await mockERC20.balanceOf(deployAcc);
        console.log(`tester-${symbol}:`, ethers.utils.formatUnits(balance, decimals))

        const remotePolyIds = Object.keys(Deployed['Gateways']);
        const gates = Object.values(Deployed['Gateways']).map(gates => gates[symbol]);

        for (let i = 0; i < gates.length; i++) {
            const gate = await ContractAt('Gateway', gates[i]);
            const debt = await vaultC.gateDebt(gate.address);
            const chainName = chains._polyToName(remotePolyIds[i]);
            console.log(`debt-${chainName}`,
                ethers.utils.formatUnits(debt.debt, decimals),
                ethers.utils.formatUnits(debt.debtFlux, decimals));
            const pendingLength = await gate.pendingLength();
            for (let i = 0; i < pendingLength; i++) {
                const pending = await gate.pending(i);
                console.log(`pending-${chainName}-${i}:`, pending.crossId.toString(), pending.to, pending.metaAmount.toString(), pending.metaFee.toString(), pending.feeFlux.toString())
                //const resp = await vaultC.callStatic.withdrawFund(pending.to, pending.metaAmount, pending.fee, pending.feeFlux, { gas: 500000 });
                //console.log('resp:', resp);
            }

            if (pendingLength > 0) {
                //await vaultC.deposit(ethers.utils.parseUnits('100', decimals));
                await gate.dealPending(pendingLength);
            }

            const remotePolyId = await gate.remotePolyId();
            console.log("pending:", remotePolyId.toString(), pendingLength.toString())
        }
    }

    const fluxPrice = await oracle.getPriceMan(FLUX.address);
    console.log('FLUX-price:', ethers.utils.formatUnits(fluxPrice, 18));
    /*
        const polyIds = Object.values(chains._raw).map(chain => chain.polyId);
        for (let i = 0; i < polyIds.length; i++) {
            const polyId = polyIds[i];
            const price = await oracle.getPriceMan(polyId.toAddress());
            console.log(`price-${polyId}:`, ethers.utils.formatUnits(price, 18));
        }
    */
    const fluxBalance = await FLUX.balanceOf(deployAcc);
    console.log('flux balance:', ethers.utils.formatUnits(fluxBalance, 18), fluxBalance.toString());
};

module.exports = func;
func.tags = ['Status'];