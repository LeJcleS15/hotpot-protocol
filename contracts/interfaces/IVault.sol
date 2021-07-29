pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IVault {
    function token() external view returns (ERC20);

    function withdrawFund(
        address to,
        uint256 amount,
        uint256 fee,
        uint256 feeFlux
    ) external;

    function depositFund(uint256 amount) external;

    function gateAmount(address) external view returns (int256);
}
