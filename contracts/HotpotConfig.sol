pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./Access.sol";
import {IEthCrossChainManager} from "./poly/IEthCrossChainManager.sol";
import {IEthCrossChainManagerProxy} from "./poly/IEthCrossChainManagerProxy.sol";
import "./interfaces/IPriceOracle.sol";

interface IHotpotConfig {
    function FLUX() external view returns (ERC20);

    function polyId() external view returns (uint64);

    function boundVault(address) external view returns (address);

    function getEthCrossChainManager() external view returns (IEthCrossChainManager);

    function feeFlux(address token, uint256 amount) external view returns (uint256);

    function isBalancer(address balancer) external view returns (bool);

    function isRouter(address) external view returns (bool);
}

contract HotpotConfig is Ownable, IHotpotConfig {
    using SafeMath for uint256;
    ERC20 public override FLUX;
    uint64 public override polyId;
    IEthCrossChainManagerProxy public ccmp;
    IAccess public access;
    address public router;
    IPriceOracle public oracle;
    mapping(address => address) public override boundVault; // gateway=>vaults

    constructor(
        uint64 _polyId,
        IEthCrossChainManagerProxy _ccmp,
        ERC20 _flux,
        IAccess _access,
        IPriceOracle _oracle
    ) public {
        polyId = _polyId;
        ccmp = _ccmp;
        FLUX = _flux;
        oracle = _oracle;
    }

    function isRouter(address) external view override returns (bool) {
        return true;
    }

    function isBalancer(address balancer) external view override returns (bool) {
        return access.isBalancer(balancer);
    }

    function bindVault(address vault, address gateway) external onlyOwner {
        boundVault[gateway] = vault;
    }

    function getEthCrossChainManager() external view override returns (IEthCrossChainManager) {
        return ccmp.getEthCrossChainManager();
    }

    function feeFlux(address token, uint256 fee) external view override returns (uint256) {
        uint256 tokenPrice = oracle.getPriceMan(token);
        uint256 fluxPrice = oracle.getPriceMan(address(FLUX));
        uint8 tokenDecimals = ERC20(token).decimals();
        uint8 fluxDecimals = FLUX.decimals();
        uint256 _feeFlux = fee.mul(10**uint256(fluxDecimals - tokenDecimals)).mul(tokenPrice).div(fluxPrice);
        return (_feeFlux * 80) / 100;
    }
}
