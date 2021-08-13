const { expect } = require("chai");
const { ethers } = require('hardhat');
const Hotpot = require('./helps/Hotpot');

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

describe("Bits Count Test", function () {

    it("Random Bits Count test", async function () {
        const rand256 = () => Math.floor(Math.random() * 256);
        const randBitmap = () => {
            const bitCounts = rand256();
            let bitmap = ethers.constants.Zero;
            const One = ethers.constants.One;
            for (let i = 0; i < bitCounts; i++) {
                while (true) {
                    const randbit = rand256();
                    const orBit = One.shl(randbit);
                    if (bitmap.and(orBit).gt(0)) continue;
                    bitmap = bitmap.or(orBit);
                    break;
                }
            }
            return { bitCounts, bitmap };
        }

        const Bits = await deploy('Bits');
        for (let i = 0; i < 256; i++) {
            const bitcase = randBitmap();
            const bitCounts = await Bits.countSetBits(bitcase.bitmap);
            expect(bitCounts).to.eq(bitcase.bitCounts);
        }
    })
})