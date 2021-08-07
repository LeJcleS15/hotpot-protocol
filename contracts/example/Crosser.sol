// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "../Router.sol";
import {IGateway} from "../interfaces/IGateway.sol";
import {IVault} from "../interfaces/IVault.sol";
import {IConfig} from "../interfaces/IConfig.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Crosser {
    function crossTransfer(
        Router router,
        IGateway gate,
        address to,
        uint256 amount,
        uint256 maxFluxFee
    ) external payable {
        IVault vault = gate.vault();
        //require(msg.value >= router.getFeeNative(gate.remotePolyId()), "fee to low");
        IConfig config = gate.config();
        IERC20 token = IERC20(address(vault.token()));
        IERC20 flux = IERC20(address(config.FLUX()));
        token.approve(address(vault), amount);
        if (maxFluxFee > 0) {
            flux.approve(address(vault), maxFluxFee);
        }
        router.crossTransfer{value: msg.value}(gate, to, amount, maxFluxFee);
    }
}
