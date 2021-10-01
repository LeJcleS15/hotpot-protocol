// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts-ethereum-package/contracts/access/AccessControl.sol";

import {IAccess} from "./interfaces/IAccess.sol";

contract Access is AccessControlUpgradeSafe, IAccess {
    bytes32 public constant BALANCER_ROLE = keccak256("BALANCER_ROLE");
    bytes32 public constant HOTPOTER_ROLE = keccak256("HOTPOTER_ROLE");
    bytes32 public constant COMPROMISER_ROLE = keccak256("COMPROMISER_ROLE");

    function initialize() external initializer {
        __AccessControl_init_unchained();
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function _setRole(
        bytes32 role,
        address account,
        bool enable
    ) private {
        if (enable) grantRole(role, account);
        else revokeRole(role, account);
    }

    function isCompromiser(address compromiser) external view override returns (bool) {
        return hasRole(COMPROMISER_ROLE, compromiser);
    }

    function setCompromiser(address compromiser, bool enable) external {
        _setRole(COMPROMISER_ROLE, compromiser, enable);
    }

    function setBalancer(address balancer, bool enable) external {
        _setRole(BALANCER_ROLE, balancer, enable);
    }

    function isBalancer(address balancer) external view override returns (bool) {
        return hasRole(BALANCER_ROLE, balancer);
    }

    function setHotpoter(address hotpoter, bool enable) external {
        _setRole(HOTPOTER_ROLE, hotpoter, enable);
    }

    function isHotpoter(address hotpoter) external view override returns (bool) {
        return hasRole(HOTPOTER_ROLE, hotpoter);
    }
}
