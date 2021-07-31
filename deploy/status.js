const record = require('../helps/record');

function ContractAt(Contract, address) {
    return ethers.getSigners().then(
        account => ethers.getContractAt(
            Contract,
            address,
            account[0]
        )
    );
}

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

    const vaultBalance = await mockERC20.balanceOf(vaultC.address);
    console.log('Vault balance:', ethers.utils.formatUnits(vaultBalance, decimals));

    const balance = await mockERC20.balanceOf(deployAcc);
    console.log('tester:', ethers.utils.formatUnits(balance, decimals))

    const gates = Object.values(Deployed['Gateways']).reduce((t, x) => [...t, ...Object.values(x)], []);

    const FLUX = await ContractAt('ERC20Mock', Mocks.FLUX);
    for (let i = 0; i < gates.length; i++) {
        const gate = gates[i];
        const balance = await mockERC20.balanceOf(gate);
        const fluxBalance = await FLUX.balanceOf(gate);
        console.log('gate:', i, ethers.utils.formatUnits(balance, decimals), ethers.utils.formatUnits(fluxBalance));
    }

    console.log('flux balance:', ethers.utils.formatUnits(await FLUX.balanceOf(deployAcc), decimals));
};

module.exports = func;
func.tags = ['Status'];