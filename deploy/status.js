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
    const keys = Object.keys(chains.TOKENS).filter(key => key == 'BTC');

    for (let ti = 0; ti < keys.length; ti++) {
        const symbol = keys[ti];
        const mockERC20 = await ContractAt('ERC20Mock', chains.TOKENS[symbol].token)
        const decimals = await mockERC20.decimals();

        const price = await oracle.getPriceMan(mockERC20.address);
        console.log(`${symbol}-price:`, ethers.utils.formatUnits(price, 18));

        const vault = Deployed.Vaults[symbol];
        const vaultC = await ContractAt('Vault', vault);

        const vaultBalance = await mockERC20.balanceOf(vaultC.address);
        console.log(`Vault ${symbol} balance:`, ethers.utils.formatUnits(vaultBalance, decimals));

        const balance = await mockERC20.balanceOf(deployAcc);
        console.log(`tester-${symbol}:`, ethers.utils.formatUnits(balance, decimals))

        const gates = Object.values(Deployed['Gateways']).map(gates => gates[symbol]);

        for (let i = 0; i < gates.length; i++) {
            const gate = await ContractAt('Gateway', gates[i]);
            const pendingLength = await gate.pendingLength();
            for (let i = 0; i < pendingLength; i++) {
                const pending = await gate.pending(i);
                console.log(`pending-${i}:`, pending.crossId.toString(), pending.to, pending.metaAmount.toString(), pending.fee.toString(), pending.feeFlux.toString())
                //const resp = await vaultC.callStatic.withdrawFund(pending.to, pending.metaAmount, pending.fee, pending.feeFlux, { gas: 500000 });
                //console.log('resp:', resp);
            }
            /*
            if (pendingLength > 0) {
                await vaultC.deposit(ethers.utils.parseUnits('100', decimals));
                await gate.dealPending(pendingLength);
            }
            */
            const remotePolyId = await gate.remotePolyId();
            console.log("pending:", remotePolyId.toString(), pendingLength.toString())
        }
    }

    const FLUX = await ContractAt('ERC20Mock', chains.FLUX);
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