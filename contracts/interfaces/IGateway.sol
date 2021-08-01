// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IGateway {
    event CrossTransfer(uint256 indexed crossId, address indexed from, address indexed to, uint256 amount, uint256 fee, uint256 feeFlux, uint256 tokenPrice, uint256 fluxPrice);
    event OnCrossTransfer(uint256 indexed crossId, uint256 indexed status, address indexed to, uint256 amount, uint256 fee, uint256 feeFlux);

    function remotePolyId() external view returns (uint64);

    function crossRebalanceFrom(
        address from,
        address to,
        uint256 amount
    ) external;

    function crossTransferFrom(
        address from,
        address to,
        uint256 amount,
        uint256 maxFluxFee
    ) external;
}
