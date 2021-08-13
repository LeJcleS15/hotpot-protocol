// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IAccess {
    function isBalancer(address balancer) external view returns (bool);

    function isHotpoter(address hotpoter) external view returns (bool);
}
