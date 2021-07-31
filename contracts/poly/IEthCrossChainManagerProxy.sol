pragma solidity 0.6.12;

import {IEthCrossChainManager} from "./IEthCrossChainManager.sol";

/**
 * @dev Interface of the EthCrossChainManagerProxy for business contract like LockProxy to obtain the reliable EthCrossChainManager contract hash.
 */

interface IEthCrossChainManagerProxy {
    function getEthCrossChainManager() external view returns (IEthCrossChainManager);
}
