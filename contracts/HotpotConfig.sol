pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IEthCrossChainManager} from "./poly/IEthCrossChainManager.sol";
import {IEthCrossChainManagerProxy} from "./poly/IEthCrossChainManagerProxy.sol";

interface IHotpotConfig {
    function FLUX() external view returns(ERC20);
    function polyId() external view returns(uint64);
    function boundVault(address) external view returns(address);
    function getEthCrossChainManager() external view returns(IEthCrossChainManager);
    function feeFlux(uint256 amount) external view returns(uint256);
}

contract HotpotConfig is Ownable,IHotpotConfig {
    ERC20 public override FLUX;
    uint64 public override polyId;
    IEthCrossChainManagerProxy public ccmp;
    mapping(address=>address) public override boundVault; // gateway=>vaults
    constructor(uint64 _polyId, IEthCrossChainManagerProxy _ccmp, ERC20 _flux) public {
        polyId = _polyId;
        ccmp = _ccmp;
        FLUX = _flux;
    }
    function bindVault(address vault, address gateway) external onlyOwner {
        boundVault[gateway] = vault;
    }

    function getEthCrossChainManager() external view override returns(IEthCrossChainManager) {
        return ccmp.getEthCrossChainManager();
    }

    function feeFlux(uint256 fee) external view override returns(uint256) {
        return fee;
    }
}