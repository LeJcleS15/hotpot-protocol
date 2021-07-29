pragma solidity 0.6.12;

interface IHotpotGate {
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
