pragma solidity 0.6.12;

interface IHotpotGate {
    function crossRebalance(address to, uint256 amount) external;

    function crossTransfer(
        address to,
        uint256 amount,
        bool useFlux
    ) external;
}
