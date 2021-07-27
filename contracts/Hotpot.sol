pragma solidity 0.6.12;

import {IEthCrossChainManager} from "./poly/IEthCrossChainManager.sol";
import {IHotpotConfig} from "./HotpotConfig.sol";
import {IVault} from "./interfaces/IVault.sol";
import {fmt} from "./fmt.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

abstract contract CrossBase is Ownable {
    function getEthCrossChainManager()
        internal
        view
        virtual
        returns (IEthCrossChainManager);

    modifier onlyManagerContract() {
        require(
            _msgSender() == address(getEthCrossChainManager()),
            "only EthCrossChainManagerContract"
        );
        _;
    }

    function crossTo(
        uint64 chainId,
        address to,
        bytes memory method,
        bytes memory data
    ) internal {
        IEthCrossChainManager ccm = getEthCrossChainManager();
        require(
            ccm.crossChain(chainId, addressToBytes(to), method, data),
            "crossChain fail!"
        );
    }

    /* @notice      Convert bytes to address
     *  @param _bs   Source bytes: bytes length must be 20
     *  @return      Converted address from source bytes
     */
    function bytesToAddress(bytes memory _bs)
        internal
        pure
        returns (address addr)
    {
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
    function addressToBytes(address _addr)
        internal
        pure
        returns (bytes memory bs)
    {
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

contract HotpotGate is CrossBase, ERC20 {
    using SafeMath for uint256;
    enum CrossStatus {
        NONE,
        PENDING,
        COMPLETED,
        REVERTED
    }
    struct CrossTransferData {
        uint256 crossId;
        address from;
        address to;
        uint256 metaAmount;
        uint256 fee;
        uint256 feeFlux;
        CrossStatus status;
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
    mapping(uint256 => CrossTransferData) public crossHistory;
    mapping(uint256 => CrossStatus) public existedIds;

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

    function getEthCrossChainManager()
        internal
        view
        override
        returns (IEthCrossChainManager)
    {
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

    function _crossReceipt(uint256 crossId, bool success) private {
        CrossBase.crossTo(
            remotePolyId,
            remoteGateway,
            "onCrossReceipt",
            abi.encode(crossId, success)
        );
        // emit event
    }

    function _onCrossReceipt(uint256 crossId, bool success)
        private
        returns (bool)
    {
        CrossTransferData storage crossData = crossHistory[crossId];
        require(crossData.status == CrossStatus.PENDING, "invalid crossId");
        uint256 tokenAmount = metaToNative(crossData.metaAmount);
        if (success) {
            fmt.Printf("_onCrossReceipt:true");
            vault.depositFund(tokenAmount); // keep fee in gate
            crossData.status = CrossStatus.COMPLETED;
        } else {
            fmt.Printf("_onCrossReceipt:false");
            uint256 _fee = crossData.fee > 0 ? metaToNative(crossData.fee) : 0;
            fmt.Printf(
                "fee: %d %d feeFlux:%d",
                abi.encode(_fee, crossData.fee, crossData.feeFlux)
            );
            token.transfer(crossData.from, tokenAmount + _fee);
            if (crossData.feeFlux > 0)
                config.FLUX().transfer(crossData.from, crossData.feeFlux);
            crossData.status = CrossStatus.REVERTED;
        }
        return true;
    }

    function onCrossReceipt(
        bytes calldata data,
        bytes calldata fromAddress,
        uint64 fromPolyId
    ) external onlyManagerContract returns (bool) {
        address from = bytesToAddress(fromAddress);
        require(bindStatus == CrossStatus.COMPLETED, "bind not completed");
        require(
            remotePolyId == fromPolyId && remoteGateway == from,
            "invalid gateway"
        );
        (uint256 crossId, bool success) = abi.decode(data, (uint256, bool));
        return _onCrossReceipt(crossId, success);
    }

    function nativeToMeta(uint256 amount) private returns (uint256) {
        uint8 tokenDecimals = token.decimals();
        uint8 metaDecimals = ERC20.decimals();
        require(
            tokenDecimals <= metaDecimals,
            "HotpotGate::unsupported decimals"
        );
        return amount.mul(10**uint256(metaDecimals - tokenDecimals));
    }

    function metaToNative(uint256 amount) private returns (uint256) {
        uint8 tokenDecimals = token.decimals();
        uint8 metaDecimals = ERC20.decimals();
        require(
            tokenDecimals <= metaDecimals,
            "HotpotGate::unsupported decimals"
        );
        return amount.div(10**uint256(metaDecimals - tokenDecimals));
    }

    function crossTransfer(
        address to,
        uint256 amount,
        bool useFlux
    ) external {
        require(bindStatus == CrossStatus.COMPLETED, "bind not completed");
        token.transferFrom(msg.sender, address(this), amount);
        uint256 metaAmount = nativeToMeta(amount);
        uint256 crossId = nextCrossId++;
        uint256 _fee = amount.mul(fee).div(FEE_DENOM);
        uint256 _feeFlux;
        if (useFlux) {
            _feeFlux = config.feeFlux(_fee);
            ERC20 flux = config.FLUX();
            flux.transferFrom(msg.sender, address(this), _fee);
            _fee = 0;
        } else {
            _fee = nativeToMeta(_fee);
            metaAmount = metaAmount.sub(_fee);
        }

        crossHistory[crossId] = CrossTransferData({
            crossId: crossId,
            from: msg.sender,
            to: to,
            metaAmount: metaAmount,
            fee: _fee,
            feeFlux: _feeFlux,
            status: CrossStatus.PENDING
        });
        bytes memory txData = abi.encode(
            crossId,
            to,
            metaAmount,
            _fee,
            _feeFlux
        );
        CrossBase.crossTo(
            remotePolyId,
            remoteGateway,
            "onCrossTransfer",
            txData
        );
        logCrossTransfer(
            msg.sender,
            address(uint160(remotePolyId)),
            metaAmount
        );
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
        require(
            remotePolyId == fromPolyId && remoteGateway == from,
            "invalid gateway"
        );
        (
            uint256 crossId,
            address to,
            uint256 metaAmount,
            uint256 _fee,
            uint256 _feeFlux
        ) = abi.decode(data, (uint256, address, uint256, uint256, uint256));
        require(existedIds[crossId] == CrossStatus.NONE, "existed crossId");
        logCrossTransfer(address(uint160(fromPolyId)), to, metaAmount);
        bool result = _onCrossTransfer(to, metaAmount, _fee, _feeFlux);
        _crossReceipt(crossId, result);
        return true;
    }
}
