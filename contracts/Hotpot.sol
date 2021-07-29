pragma solidity 0.6.12;

import {IEthCrossChainManager} from "./poly/IEthCrossChainManager.sol";
import {IHotpotConfig} from "./HotpotConfig.sol";
import {IHotpotGate} from "./interfaces/IHotpotGate.sol";
import {IVault} from "./interfaces/IVault.sol";
import {fmt} from "./fmt.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";

abstract contract CrossBase is Ownable {
    function getEthCrossChainManager() internal view virtual returns (IEthCrossChainManager);

    modifier onlyManagerContract() {
        require(_msgSender() == address(getEthCrossChainManager()), "only EthCrossChainManagerContract");
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

contract HotpotGate is CrossBase, ERC20, IHotpotGate {
    using SafeMath for uint256;
    using SignedSafeMath for int256;
    enum CrossStatus {
        NONE,
        PENDING,
        COMPLETED,
        REVERTED
    }
    IHotpotConfig public config;
    uint64 public remotePolyId;
    address public remoteGateway;
    CrossStatus public bindStatus;
    IVault public vault;
    ERC20 public token;
    uint256 public nextCrossId;
    uint256 public fee;
    uint256 public constant FEE_DENOM = 10000;
    mapping(uint256 => CrossStatus) public existedIds;

    struct PendingTransfer {
        uint256 crossId;
        address to;
        uint256 metaAmount;
        uint256 fee;
        uint256 feeFlux;
    }
    PendingTransfer[] public pending;

    modifier onlyRouter() {
        require(config.isRouter(msg.sender), "onlyRouter");
        _;
    }

    constructor(
        IHotpotConfig _config,
        IVault _vault,
        string memory _name,
        string memory _symbol
    ) public ERC20(_name, _symbol) {
        config = _config;
        vault = _vault;
        token = _vault.token();
        token.approve(address(vault), type(uint256).max);
        _setupDecimals(18);
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

    function logCrossTransfer(
        address from,
        address to,
        uint256 metaAmount
    ) private {
        ERC20._mint(from, metaAmount);
        ERC20._transfer(from, to, metaAmount);
    }

    function nativeToMeta(uint256 amount) private returns (uint256) {
        uint8 tokenDecimals = token.decimals();
        uint8 metaDecimals = ERC20.decimals();
        require(tokenDecimals <= metaDecimals, "HotpotGate::unsupported decimals");
        return amount.mul(10**uint256(metaDecimals - tokenDecimals));
    }

    function metaToNative(uint256 amount) private returns (uint256) {
        uint8 tokenDecimals = token.decimals();
        uint8 metaDecimals = ERC20.decimals();
        require(tokenDecimals <= metaDecimals, "HotpotGate::unsupported decimals");
        return amount.div(10**uint256(metaDecimals - tokenDecimals));
    }

    function _crossTransfer(
        address to,
        uint256 amount,
        uint256 _fee,
        uint256 _feeFlux
    ) private {
        uint256 crossId = nextCrossId++;
        uint256 metaFee = nativeToMeta(_fee);
        uint256 metaAmount = nativeToMeta(amount).sub(metaFee);
        bytes memory txData = abi.encode(crossId, to, metaAmount, metaFee, _feeFlux);
        CrossBase.crossTo(remotePolyId, remoteGateway, "onCrossTransfer", txData);
        logCrossTransfer(msg.sender, address(uint160(remotePolyId)), metaAmount);
    }

    function crossRebalanceFrom(
        address from,
        address to,
        uint256 amount
    ) external override onlyRouter {
        require(bindStatus == CrossStatus.COMPLETED, "bind not completed");
        require(config.isBalancer(from), "onlyBalancer");
        vault.depositFund(from, amount);
        int256 gap = vault.gateAmount(address(this));
        require(gap < 0 && gap.add(int256(amount)) <= 0, "invalid amount");
        _crossTransfer(to, amount, 0, 0);
    }

    function crossTransferFrom(
        address from,
        address to,
        uint256 amount,
        uint256 maxFluxFee
    ) external override onlyRouter {
        require(bindStatus == CrossStatus.COMPLETED, "bind not completed");
        vault.depositFund(from, amount);
        uint256 _fee = amount.mul(fee).div(FEE_DENOM);
        uint256 _feeFlux;
        if (maxFluxFee > 0) {
            _feeFlux = config.feeFlux(address(token), _fee);
            require(_feeFlux <= maxFluxFee, "execeed flux fee limit!");
            ERC20 flux = config.FLUX();
            flux.transferFrom(from, address(this), _feeFlux);
            _fee = 0;
        }
        _crossTransfer(to, amount, _fee, _feeFlux);
    }

    function _onCrossTransfer(
        address to,
        uint256 metaAmount,
        uint256 _fee,
        uint256 _feeFlux
    ) private returns (bool) {
        uint256 tokenAmount = metaToNative(metaAmount);
        return vault.withdrawFund(to, tokenAmount, _fee, _feeFlux);
    }

    function onCrossTransfer(
        bytes calldata data,
        bytes calldata fromAddress,
        uint64 fromPolyId
    ) external onlyManagerContract returns (bool) {
        address from = bytesToAddress(fromAddress);
        require(bindStatus == CrossStatus.COMPLETED, "bind not completed");
        require(remotePolyId == fromPolyId && remoteGateway == from, "invalid gateway");
        (uint256 crossId, address to, uint256 metaAmount, uint256 _fee, uint256 _feeFlux) = abi.decode(data, (uint256, address, uint256, uint256, uint256));
        require(existedIds[crossId] == CrossStatus.NONE, "existed crossId");

        logCrossTransfer(address(uint160(fromPolyId)), to, metaAmount);
        if (_onCrossTransfer(to, metaAmount, _fee, _feeFlux)) {
            existedIds[crossId] = CrossStatus.COMPLETED;
        } else {
            existedIds[crossId] = CrossStatus.PENDING;
            pending.push(PendingTransfer(crossId, to, metaAmount, _fee, _feeFlux));
        }
        return true;
    }

    function pendingLength() external view returns (uint256) {
        return pending.length;
    }

    function dealPending(uint256 count) external {
        while (count-- < 0) {
            PendingTransfer storage _pending = pending[pending.length - 1];
            if (!_onCrossTransfer(_pending.to, _pending.metaAmount, _pending.fee, _pending.feeFlux)) return;
            existedIds[_pending.crossId] = CrossStatus.COMPLETED;
            pending.pop();
        }
    }

    function withdraw(IERC20 _token, uint256 amount) external onlyOwner {
        _token.transfer(msg.sender, amount);
    }
}
