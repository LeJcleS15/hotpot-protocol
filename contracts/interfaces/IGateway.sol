// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import {IVault} from "./IVault.sol";
import {IConfig} from "./IConfig.sol";

interface IGateway {
    event CrossTransfer(uint256 indexed crossId, address indexed from, address indexed to, uint256 amount, uint256 fee, int256 feeFlux, uint256 tokenPrice, uint256 fluxPrice);
    event OnCrossTransfer(uint256 indexed crossId, uint256 indexed status, address indexed to, uint256 amount, uint256 fee, int256 feeFlux);
    event CrossConfirm(bytes32 indexed crossSig, uint256 indexed relayerRole, uint256 confirmStatus);

    function remotePolyId() external view returns (uint64);

    function crossRebalanceFrom(
        address from,
        address to,
        uint256 amount,
        uint256 fluxAmount
    ) external;

    function crossTransferFrom(
        address from,
        address to,
        uint256 amount,
        uint256 maxFluxFee
    ) external;

    function vault() external view returns (IVault);

    function config() external view returns (IConfig);
}
