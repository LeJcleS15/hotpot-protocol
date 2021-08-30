// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./IHotpotCallee.sol";

interface IExtCaller {
    event CallExt(address gateway, address to, address from, uint64 fromChainId, address token, uint256 amount, bytes callData, bool success, bytes retData);

    function callExt(
        IHotpotCallee toContract,
        uint64 fromPolyId,
        address from,
        address token,
        uint256 amount,
        bytes calldata data
    ) external;
}
