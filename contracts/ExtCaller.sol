// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./interfaces/IHotpotCallee.sol";
import "./interfaces/IExtCaller.sol";
import {IConfig} from "./interfaces/IConfig.sol";

contract ExtCaller is IExtCaller {
    IConfig public config;

    modifier onlyGateway() {
        require(address(0) != config.boundVault(msg.sender), "onlyGateway");
        _;
    }

    constructor(IConfig _config) public {
        config = _config;
    }

    function callExt(
        IHotpotCallee toContract,
        uint64 fromPolyId,
        address from,
        address token,
        uint256 amount,
        bytes calldata data
    ) external override onlyGateway {
        (bool success, bytes memory retData) = address(toContract).call(abi.encodeWithSelector(IHotpotCallee.hotpotCallback.selector, fromPolyId, from, token, amount, data));
        emit CallExt(msg.sender, address(toContract), from, fromPolyId, token, amount, data, success, retData);
    }
}
