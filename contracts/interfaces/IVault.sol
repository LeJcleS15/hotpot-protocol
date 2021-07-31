// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";

interface IVault {
    function token() external view returns (IERC20);

    function withdrawFund(
        address to,
        uint256 amount,
        uint256 fee,
        uint256 feeFlux
    ) external returns (bool);

    function depositFund(address from, uint256 amount) external;

    function gateAmount(address) external view returns (int256);
}
