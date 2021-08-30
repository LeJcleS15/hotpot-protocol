// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./IGateway.sol";

interface IRouter {
    function crossTransfer(
        IGateway gate,
        address to,
        uint256 amount,
        uint256 maxFluxFee
    ) external payable;

    function crossTransfer(
        IGateway gate,
        address to,
        uint256 amount,
        uint256 maxFluxFee,
        bytes calldata data
    ) external payable;
}
