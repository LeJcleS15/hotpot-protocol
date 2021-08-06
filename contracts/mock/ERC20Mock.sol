// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Mock is ERC20 {
    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) public ERC20(_name, _symbol) {
        ERC20._setupDecimals(_decimals);
    }

    function mint(address to, uint256 amount) external {
        ERC20._mint(to, amount);
    }
}
