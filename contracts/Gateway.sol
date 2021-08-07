// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SignedSafeMath.sol";
import {ERC20UpgradeSafe} from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";

import {IEthCrossChainManager} from "./interfaces/poly/IEthCrossChainManager.sol";
import {IConfig} from "./interfaces/IConfig.sol";
import {IGateway} from "./interfaces/IGateway.sol";
import {IVault} from "./interfaces/IVault.sol";

abstract contract CrossBase {
    function getEthCrossChainManager() internal view virtual returns (IEthCrossChainManager);

    modifier onlyManagerContract() {
        require(msg.sender == address(getEthCrossChainManager()), "only EthCrossChainManagerContract");
        _;
    }

    function crossTo(
        uint64 chainId,
        address to,
        bytes memory method,
        bytes memory data
    ) internal {
        IEthCrossChainManager ccm = getEthCrossChainManager();
        require(ccm.crossChain(chainId, addressToBytes(to), method, data), "crossChain fail!");
    }

    /* @notice      Convert bytes to address
     *  @param _bs   Source bytes: bytes length must be 20
     *  @return      Converted address from source bytes
     */
    function bytesToAddress(bytes memory _bs) internal pure returns (address addr) {
        require(_bs.length == 20, "bytes length does not match address");
        assembly {
            // for _bs, first word store _bs.length, second word store _bs.value
            // load 32 bytes from mem[_bs+20], convert it into Uint160, meaning we take last 20 bytes as addr (address).
            addr := mload(add(_bs, 0x14))
        }
    }

    /* @notice      Convert address to bytes
     *  @param _addr Address need to be converted
     *  @return      Converted bytes from address
     */
    function addressToBytes(address _addr) internal pure returns (bytes memory bs) {
        assembly {
            // Get a location of some free memory and store it in result as
            // Solidity does for memory variables.
            bs := mload(0x40)
            // Put 20 (address byte length) at the first word, the length of bytes for uint256 value
            mstore(bs, 0x14)
            // logical shift left _a by 12 bytes, change _a from right-aligned to left-aligned
            mstore(add(bs, 0x20), shl(96, _addr))
            // Update the free-memory pointer by padding our last write location to 32 bytes
            mstore(0x40, add(bs, 0x40))
        }
    }
}

contract Gateway is OwnableUpgradeSafe, CrossBase, IGateway {
    using SafeMath for uint256;
    using SignedSafeMath for int256;
    using SafeERC20 for IERC20;
    enum CrossStatus {
        NONE,
        PENDING,
        COMPLETED,
        REVERTED
    }
    IConfig public config;
    uint64 public override remotePolyId;
    address public remoteGateway;
    CrossStatus public bindStatus;
    IVault public vault;
    IERC20 public token;
    uint256 public nextCrossId;
    uint256 public fee;
    uint256 public constant FEE_DENOM = 10000;
    mapping(uint256 => CrossStatus) public existedIds;
    uint8 public constant decimals = 18;

    struct PendingTransfer {
        uint256 crossId;
        address to;
        uint256 metaAmount;
        uint256 metaFee;
        int256 feeFlux;
    }
    PendingTransfer[] public pending;

    modifier onlyRouter() {
        require(config.isRouter(msg.sender), "onlyRouter");
        _;
    }

    function initialize(IConfig _config, IVault _vault) external initializer {
        OwnableUpgradeSafe.__Ownable_init();
        config = _config;
        vault = _vault;
        token = _vault.token();
        token.approve(address(vault), type(uint256).max);
        fee = 30;
    }

    function getEthCrossChainManager() internal view override returns (IEthCrossChainManager) {
        return config.getEthCrossChainManager();
    }

    function bindGateway(uint64 polyId, address gateway) external onlyOwner {
        remotePolyId = polyId;
        remoteGateway = gateway;
        bindStatus = CrossStatus.COMPLETED;
    }

    function setFee(uint256 _fee) external onlyOwner {
        fee = _fee;
    }

    function nativeToMeta(uint256 amount) private view returns (uint256) {
        uint8 tokenDecimals = ERC20UpgradeSafe(address(token)).decimals();
        uint8 metaDecimals = decimals;
        require(tokenDecimals <= metaDecimals, "HotpotGate::unsupported decimals");
        return amount.mul(10**uint256(metaDecimals - tokenDecimals));
    }

    function metaToNative(uint256 amount) private view returns (uint256) {
        uint8 tokenDecimals = ERC20UpgradeSafe(address(token)).decimals();
        uint8 metaDecimals = decimals;
        require(tokenDecimals <= metaDecimals, "HotpotGate::unsupported decimals");
        return amount.div(10**uint256(metaDecimals - tokenDecimals));
    }

    function _crossTransfer(
        address from,
        address to,
        uint256 amount,
        uint256 _fee,
        int256 _feeFlux
    ) private {
        uint256 crossId = nextCrossId++;
        uint256 metaFee = nativeToMeta(_fee);
        uint256 metaAmount = nativeToMeta(amount).sub(metaFee);
        bytes memory txData = abi.encode(crossId, to, metaAmount, metaFee, _feeFlux);
        CrossBase.crossTo(remotePolyId, remoteGateway, "onCrossTransfer", txData);
        (uint256 tokenPrice, uint256 fluxPrice) = config.feePrice(address(token));
        emit CrossTransfer(crossId, from, to, metaAmount, metaFee, _feeFlux, tokenPrice, fluxPrice);
    }

    function crossRebalanceFrom(
        address from,
        address to,
        uint256 amount,
        uint256 fluxAmount
    ) external override onlyRouter {
        require(fluxAmount >= 0, "invalid flux amount");
        require(bindStatus == CrossStatus.COMPLETED, "bind not completed");
        require(config.isBalancer(from), "onlyBalancer");
        (int256 debt, int256 debtFlux) = vault.gateDebt(address(this));
        require(debt.add(int256(amount)) <= 0, "invalid amount");
        require(debtFlux.add(int256(fluxAmount)) <= 0, "invalid amount");
        vault.depositFund(from, uint256(amount), fluxAmount);
        _crossTransfer(from, to, amount, 0, -int256(fluxAmount));
    }

    function crossTransferFrom(
        address from,
        address to,
        uint256 amount,
        uint256 maxFluxFee
    ) external override onlyRouter {
        require(bindStatus == CrossStatus.COMPLETED, "bind not completed");
        uint256 _fee = amount.mul(fee).div(FEE_DENOM);
        uint256 _feeFlux;
        if (maxFluxFee > 0) {
            _feeFlux = config.feeFlux(address(token), _fee);
            _fee = 0;
            require(_feeFlux <= maxFluxFee, "execeed flux fee limit!");
        }
        vault.depositFund(from, amount, _feeFlux);
        require(_feeFlux < uint256(type(int256).max), "invalid fee");
        _crossTransfer(from, to, amount, _fee, int256(_feeFlux));
        dealPending(1);
    }

    function _onCrossTransfer(
        address to,
        uint256 metaAmount,
        uint256 metaFee,
        int256 _feeFlux
    ) private returns (bool) {
        uint256 tokenAmount = metaToNative(metaAmount);
        uint256 tokenFee = metaToNative(metaFee);
        uint256 before = token.balanceOf(to);
        (bool success, ) = address(vault).call(abi.encodeWithSelector(vault.withdrawFund.selector, to, tokenAmount, tokenFee, _feeFlux));
        return success && token.balanceOf(to) == tokenAmount.add(before);
    }

    function onCrossTransfer(
        bytes calldata data,
        bytes calldata fromAddress,
        uint64 fromPolyId
    ) external onlyManagerContract returns (bool) {
        address from = bytesToAddress(fromAddress);
        require(bindStatus == CrossStatus.COMPLETED, "bind not completed");
        require(remotePolyId == fromPolyId && remoteGateway == from, "invalid gateway");
        (uint256 crossId, address to, uint256 metaAmount, uint256 metaFee, int256 _feeFlux) = abi.decode(data, (uint256, address, uint256, uint256, int256));
        require(existedIds[crossId] == CrossStatus.NONE, "existed crossId");

        if (_onCrossTransfer(to, metaAmount, metaFee, _feeFlux)) {
            existedIds[crossId] = CrossStatus.COMPLETED;
            emit OnCrossTransfer(crossId, uint256(CrossStatus.COMPLETED), to, metaAmount, metaFee, _feeFlux);
            dealPending(1);
        } else {
            existedIds[crossId] = CrossStatus.PENDING;
            pending.push(PendingTransfer(crossId, to, metaAmount, metaFee, _feeFlux));
            emit OnCrossTransfer(crossId, uint256(CrossStatus.PENDING), to, metaAmount, metaFee, _feeFlux);
        }
        return true;
    }

    function pendingLength() external view returns (uint256) {
        return pending.length;
    }

    function dealPending(uint256 count) public {
        if (pending.length == 0) return;
        while (count-- > 0) {
            PendingTransfer storage _pending = pending[pending.length - 1];
            if (!_onCrossTransfer(_pending.to, _pending.metaAmount, _pending.metaFee, _pending.feeFlux)) return;
            existedIds[_pending.crossId] = CrossStatus.COMPLETED;
            emit OnCrossTransfer(_pending.crossId, uint256(CrossStatus.COMPLETED), _pending.to, _pending.metaAmount, _pending.metaFee, _pending.feeFlux);
            pending.pop();
        }
    }
}
