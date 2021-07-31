// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IFToken {
    function underlying() external view returns (address);

    function borrow(uint256 amount) external returns (bool);

    function borrowBalanceOf(address acct) external view returns (uint256);

    function repay(uint256 amount) external;
}
