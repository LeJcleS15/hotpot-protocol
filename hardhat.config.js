
require("./hotpot.task");
require("@nomiclabs/hardhat-ethers");
require("hardhat-deploy");
//const record = require('./helps/record');
const { extendEnvironment } = require('hardhat/config');


extendEnvironment(async hre => {
  // getter setter?
  hre.Mock = "mock.json";
  hre.Record = "record.json";
  const network = await hre.ethers.provider.getNetwork();
  hre.chainId = network.chainId;
});
/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  //defaultNetwork: 'hardhat',
  networks: {
    chainA:{
      url: "http://127.0.0.1:11000"
    },
    chainB:{
      url: "http://127.0.0.1:12000"
    }
  },
  solidity: "0.6.12",
};
