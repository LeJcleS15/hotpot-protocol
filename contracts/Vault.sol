pragma solidity 0.6.12;

import {IHotpotConfig} from "./HotpotConfig.sol";
import {IVault} from "./interfaces/IVault.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract Vault is IVault,Ownable {
    ERC20 public override token;
    IHotpotConfig public config;
    constructor(IHotpotConfig _config, ERC20 _token) public {
        config = _config;
        token = _token;
    }

    modifier onlyBound() {
        require(config.boundVault(msg.sender) == address(this), "Vault::onlyBound");
        _;
    }

    function withdrawFund(address to, uint256 amount, uint256 fee, uint256 feeFlux) external override onlyBound returns(bool) {
        return token.transfer(to, amount);
    }

    function depositFund(uint256 amount) external override onlyBound {
        token.transferFrom(msg.sender, address(this), amount);
    }

    function deposit(uint256 amount) external {
        token.transferFrom(msg.sender, address(this), amount);
    }
}