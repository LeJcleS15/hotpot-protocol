// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import {ERC20UpgradeSafe} from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";

import {IAccess} from "./interfaces/IAccess.sol";
import {IEthCrossChainManager} from "./interfaces/poly/IEthCrossChainManager.sol";
import {IEthCrossChainManagerProxy} from "./interfaces/poly/IEthCrossChainManagerProxy.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {IConfig} from "./interfaces/IConfig.sol";

import {IExtCaller} from "./interfaces/IExtCaller.sol";

contract Config is OwnableUpgradeSafe, IConfig {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    IERC20 public override FLUX;
    IEthCrossChainManagerProxy public ccmp;
    IAccess public access;
    address public router;
    IPriceOracle public oracle;
    mapping(address => address) public override boundVault; // gateway=>vaults
    IExtCaller public override caller;

    function initialize(
        IEthCrossChainManagerProxy _ccmp,
        IERC20 _flux,
        IAccess _access,
        IPriceOracle _oracle,
        address _router
    ) external initializer {
        OwnableUpgradeSafe.__Ownable_init();
        ccmp = _ccmp;
        FLUX = _flux;
        oracle = _oracle;
        access = _access;
        router = _router;
    }

    function isRouter(address _router) external view override returns (bool) {
        return _router == router;
    }

    function isBalancer(address balancer) external view override returns (bool) {
        return access.isBalancer(balancer);
    }

    function isHotpoter(address hotpoter) external view override returns (bool) {
        return access.isHotpoter(hotpoter);
    }

    function bindVault(address vault, address gateway) external onlyOwner {
        boundVault[gateway] = vault;
    }

    function getEthCrossChainManager() external view override returns (IEthCrossChainManager) {
        return ccmp.getEthCrossChainManager();
    }

    function feePrice(address token) external view override returns (uint256, uint256) {
        return (oracle.getPriceMan(token), oracle.getPriceMan(address(FLUX)));
    }

    function feeFlux(address token, uint256 fee) external view override returns (uint256) {
        uint256 _feePrice = oracle.getPriceMan(token);
        uint256 fluxPrice = oracle.getPriceMan(address(FLUX));
        uint8 tokenDecimals = ERC20UpgradeSafe(token).decimals();
        uint8 fluxDecimals = ERC20UpgradeSafe(address(FLUX)).decimals();
        uint256 _feeFlux = fee.mul(10**uint256(fluxDecimals - tokenDecimals)).mul(_feePrice).div(fluxPrice);
        return (_feeFlux * 80) / 100;
    }

    function setCaller(IExtCaller _caller) external onlyOwner {
        caller = _caller;
    }
}
