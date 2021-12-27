// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IHotpotCallee.sol";
import {IConfig} from "../interfaces/IConfig.sol";

contract Callee is Ownable, IHotpotCallee {
    event HotpotCallback(uint64 fromPolyId, address from, address token, uint256 amount, bytes data);
    IConfig public config;

    constructor(IConfig _config) public {
        config = _config;
    }

    modifier onlyHotpotCaller() {
        require(address(config.extCaller()) == msg.sender, "onlyHotpotCaller");
        _;
    }

    function hotpotCallback(
        uint64 fromChainId,
        address from,
        address token,
        uint256 amount,
        bytes calldata data
    ) external override onlyHotpotCaller {
        //require(from == 0xXXX, "");
        require(IERC20(token).balanceOf(address(this)) >= amount, "simple balance check");
        emit HotpotCallback(fromChainId, from, token, amount, data);
    }
}
