
const { task } = require("hardhat/config");
task("hotpotInit", "create hotpot").addParam("net", "netname").setAction(
    async taskArgs => {
      console.log(taskArgs);
      console.log(hre.network)
    }
)