// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts-ethereum-package/contracts/access/AccessControl.sol";

import {IAccess} from "./interfaces/IAccess.sol";

contract Access is AccessControlUpgradeSafe, IAccess {
    bytes32 public constant BALANCER_ROLE = keccak256("BALANCER_ROLE");
    bytes32 public constant HOTPOTER_ROLE = keccak256("HOTPOTER_ROLE");

    function initialize() external initializer {
        __AccessControl_init_unchained();
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function setBalancer(address balancer, bool enable) external {
        if (enable) grantRole(BALANCER_ROLE, balancer);
        else revokeRole(BALANCER_ROLE, balancer);
    }

    function isBalancer(address balancer) external view override returns (bool) {
        return hasRole(BALANCER_ROLE, balancer);
    }

    function setHotpoter(address hotpoter, bool enable) external {
        if (enable) grantRole(HOTPOTER_ROLE, hotpoter);
        else revokeRole(HOTPOTER_ROLE, hotpoter);
    }

    function isHotpoter(address hotpoter) external view override returns (bool) {
        return hasRole(HOTPOTER_ROLE, hotpoter);
    }
}
