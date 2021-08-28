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

contract Config is OwnableUpgradeSafe, IConfig {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    IERC20 public override FLUX;
    IEthCrossChainManagerProxy public ccmp;
    IAccess public access;
    address public router;
    IPriceOracle public oracle;
    mapping(address => address) public override boundVault; // gateway=>vaults
    uint256 public constant OEC_CHAIN_ID = 66;
    uint256 public constant HECO_CHAIN_ID = 128;
    uint256 public constant BSC_CHAIN_ID = 56;

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

    function getChainID() public pure returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }

    function isRouter(address _router) external view override returns (bool) {
        address oldRouter;
        uint256 chainId = getChainID();
        if (chainId == BSC_CHAIN_ID) oldRouter = 0x87d2aB3c3f355b68d84eAB1cf03E6bC838Bc2901;
        else if (chainId == HECO_CHAIN_ID) oldRouter = 0x1E6C2D90Eb956bD8bd0F804B2D5d0dc035E602Fd;
        else if (chainId == OEC_CHAIN_ID) oldRouter = 0x87d2aB3c3f355b68d84eAB1cf03E6bC838Bc2901;
        return _router == oldRouter || _router == router;
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
}

contract ConfigFix is Config {
    function fix() external {
        require(getChainID() == OEC_CHAIN_ID, "only OEC");
        require(address(oracle) == 0x21a276b169F51A0725dbc708C09eA7e1C4D94488, "oracle check");
        oracle = IPriceOracle(0xd249C5D313Bfe6c57Da0AA6cc9Db5F87cBC137a3);
    }

    function setRouter(address _router) external onlyOwner {
        address oldRouter;
        uint256 chainId = getChainID();
        if (chainId == BSC_CHAIN_ID) oldRouter = 0x87d2aB3c3f355b68d84eAB1cf03E6bC838Bc2901;
        else if (chainId == HECO_CHAIN_ID) oldRouter = 0x1E6C2D90Eb956bD8bd0F804B2D5d0dc035E602Fd;
        else if (chainId == OEC_CHAIN_ID) oldRouter = 0x87d2aB3c3f355b68d84eAB1cf03E6bC838Bc2901;
        require(router == oldRouter && oldRouter != address(0), "old router cehck");
        router = _router;
    }
}
