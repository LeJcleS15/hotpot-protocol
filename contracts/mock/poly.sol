pragma solidity 0.6.12;

import {IEthCrossChainManager} from "../poly/IEthCrossChainManager.sol";
import {IEthCrossChainManagerProxy} from "../poly/IEthCrossChainManagerProxy.sol";
import {fmt} from "../fmt.sol";

contract PolyMock is IEthCrossChainManager, IEthCrossChainManagerProxy {
    event CrossChain(
        uint64 fromId,
        address fromComtract,
        uint64 chainId,
        address toContract,
        bytes method,
        bytes txData
    );

    function getChainID() public view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }

    function getEthCrossChainManager()
        external
        view
        override
        returns (IEthCrossChainManager)
    {
        return IEthCrossChainManager(this);
    }

    function crossChain(
        uint64 _toChainId,
        bytes calldata _toContract,
        bytes calldata _method,
        bytes calldata _txData
    ) external override returns (bool) {
        uint64 chainID = uint64(getChainID());
        address toContract = bytesToAddress(_toContract);
        emit CrossChain(chainID, msg.sender, _toChainId, toContract, _method, _txData);
        return true;
    }

    mapping(bytes32=>bool) public txExisted;

    function crossHandler(
        bytes32 txHash,
        uint64 fromChainId,
        address fromContract,
        uint64 _toChainId,
        address _toContract,
        bytes calldata _method,
        bytes calldata _txData
    ) external {
        require(!txExisted[txHash], "tx existed");
        txExisted[txHash] = true;
        /*
        The returnData will be bytes32, the last byte must be 01;
        */
        (bool success, bytes memory returnData) = _toContract.call(
            abi.encodePacked(
                bytes4(
                    keccak256(abi.encodePacked(_method, "(bytes,bytes,uint64)"))
                ),
                abi.encode(_txData, addressToBytes(fromContract), fromChainId)
            )
        );

        /*
        Ensure the executation is successful
        */
        if(!success && returnData.length != 0) {
            fmt.Printf("call revert: %b", abi.encode(returnData));
        }
        require(success == true, "EthCrossChain call business contract failed");
        /*
        Ensure the returned value is true
        */
        require(
            returnData.length != 0,
            "No return value from business contract!"
        );

        bool res = abi.decode(returnData, (bool));
        require(
            res == true,
            "EthCrossChain call business contract return is not true"
        );
    }

    function bytesToAddress(bytes memory _bs)
        internal
        pure
        returns (address addr) {
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
    function addressToBytes(address _addr) internal pure returns (bytes memory bs){
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
