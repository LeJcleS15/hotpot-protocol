const { ethers } = require('hardhat');
const record = require('../helps/record');
const polyIds = require('../PolyIds.json');

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

    const accounts = await ethers.getSigners();
    const deployAcc = accounts[0].address;
    console.log(deployAcc);

    const Mocks = record(hre.Mock);
    const mockERC20 = await ContractAt('ERC20Mock', Mocks['ERC20Mocks']['ETH'])
    const decimals = await mockERC20.decimals();
    const amount = ethers.utils.parseUnits("1000", decimals);

    const Deployed = record(hre.Record);
    const vault = Deployed['Vaults']['ETH'];
    const vaultC = await ContractAt('Vault', vault);
    if (await mockERC20.balanceOf(vaultC.address) < amount) {
        console.log('mint to Vault:', ethers.utils.formatUnits(amount, decimals))
        await mockERC20.mint(deployAcc, amount);
        const allowance = await mockERC20.allowance(deployAcc, vaultC.address);
        if (allowance < amount)
            await mockERC20.approve(vaultC.address, ethers.constants.MaxUint256);
        await vaultC.deposit(amount);
    }
    const vaultBalance = await mockERC20.balanceOf(vaultC.address);
    console.log('Vault balance:', ethers.utils.formatUnits(vaultBalance, decimals));
    if (await mockERC20.balanceOf(deployAcc) == 0) {
        console.log('mint to user:', ethers.utils.formatUnits(amount, decimals))
        await mockERC20.mint(deployAcc, amount);
    }
    const balance = await mockERC20.balanceOf(deployAcc);
    console.log('tester:', ethers.utils.formatUnits(balance, decimals))

    const gates = Object.values(Deployed['Gateways']).reduce((t, x) => [...t, ...Object.values(x)], []);

    const FLUX = await ContractAt('ERC20Mock', Mocks.FLUX);
    for (let i = 0; i < gates.length; i++) {
        const gate = gates[i];
        const balance = await mockERC20.balanceOf(gate);
        const fluxBalance = await FLUX.balanceOf(gate);
        if (fluxBalance == 0) {
            console.log('mint flux to gate:', ethers.utils.formatUnits(amount, decimals));
            FLUX.mint(gate, amount);
        }
        console.log('gate:', i, ethers.utils.formatUnits(balance, decimals), ethers.utils.formatUnits(fluxBalance));
    }

    if (await FLUX.balanceOf(deployAcc) == 0) {
        console.log('mint flux to user:', ethers.utils.formatUnits(amount, decimals));
        await FLUX.mint(deployAcc, amount);
    }
    console.log('flux balance:', ethers.utils.formatUnits(await FLUX.balanceOf(deployAcc), decimals));

    const oracle = await ContractAt('SimplePriceOracle', Mocks.SimplePriceOracle);
    await oracle.batchSetPrice([mockERC20.address, FLUX.address], [ethers.utils.parseUnits("2500", decimals), ethers.utils.parseUnits("0.8", decimals)])
    await oracle.batchSetPrice(polyIds.map(ids => ids.toAddress()), polyIds.map(ids => ethers.utils.parseUnits(String(ids), decimals)))
    const ethPrice = await oracle.getPriceMan(mockERC20.address);
    const fluxPrice = await oracle.getPriceMan(FLUX.address);
    console.log("ethPrice:", ethers.utils.formatUnits(ethPrice));
    console.log("fluxPrice:", ethers.utils.formatUnits(fluxPrice));
};

module.exports = func;
func.tags = ['MockInit'];