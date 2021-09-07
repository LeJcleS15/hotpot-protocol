// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./interfaces/IHotpotCallee.sol";
import "./interfaces/IExtCaller.sol";
import "./interfaces/IConfig.sol";
import "./utils/chainIds.sol";

contract ExtCaller is IExtCaller {
    IConfig public config;
    using chainIds for uint64;

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
        uint64 fromChainId = uint64(fromPolyId.toChainId());
        toContract.hotpotCallback(fromChainId, from, token, amount, data);
    }
}
