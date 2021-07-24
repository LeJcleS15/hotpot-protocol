// SPDX-License-Identifier: MIT
// Created by Flux Team

pragma solidity 0.6.12;

contract Bob {
    address public owner;

    constructor() public {
        owner = msg.sender;
    }
}
