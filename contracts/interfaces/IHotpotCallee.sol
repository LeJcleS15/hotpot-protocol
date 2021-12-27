// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IHotpotCallee {
    // onlyHotpotCaller
    function hotpotCallback(
        uint64 fromChainId,
        address from,
        address token,
        uint256 amount,
        bytes calldata data
    ) external;
}
