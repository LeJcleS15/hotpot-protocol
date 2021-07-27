pragma solidity 0.6.12;

import {IHotpotConfig} from "./HotpotConfig.sol";
import {IVault} from "./interfaces/IVault.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";

abstract contract RewardDistributor {
    using SafeMath for uint256;
    using SignedSafeMath for int256;
    struct UserRewards {
        uint256 rewardPerToken;
        uint256 rewardFluxPerToken;
        uint256 reward;
        uint256 rewardFlux;
    }
    uint256 public rewardPerTokenStored;
    uint256 public rewardFluxPerTokenStored;
    mapping(address => UserRewards) public rewards;

    function updateIncome(
        uint256 fee,
        uint256 feeFlux,
        uint256 totalTokens
    ) internal {
        if (fee > 0) {
            rewardPerTokenStored = rewardPerTokenStored.add(fee.mul(1e18).div(totalTokens));
        }
        if (feeFlux > 0) {
            rewardFluxPerTokenStored = rewardFluxPerTokenStored.add(feeFlux.mul(1e18).div(totalTokens));
        }
    }

    function updateReward(address account, uint256 shares) internal {
        UserRewards storage _reward = rewards[account];
        uint256 userRewardFluxPerToken = _reward.rewardFluxPerToken;
        uint256 _rewardFluxPerTokenStored = rewardFluxPerTokenStored;
        if (userRewardFluxPerToken != _rewardFluxPerTokenStored) {
            _reward.rewardFluxPerToken = shares.mul(_rewardFluxPerTokenStored.sub(userRewardFluxPerToken)).div(1e18).add(_reward.rewardFluxPerToken);
            _reward.rewardFluxPerToken = rewardFluxPerTokenStored;
        }

        uint256 userRewardPerTokenStored = _reward.rewardPerToken;
        uint256 _rewardPerTokenStored = rewardPerTokenStored;
        if (userRewardPerTokenStored != rewardPerTokenStored) {
            _reward.reward = shares.mul(_rewardPerTokenStored.sub(userRewardPerTokenStored)).div(1e18).add(_reward.reward);
            _reward.rewardPerToken = rewardPerTokenStored;
        }
    }

    function rewardOut(
        address to,
        uint256 reward,
        uint256 fluxReward
    ) internal virtual;

    function harvest() external {
        UserRewards storage _reward = rewards[msg.sender];
        uint256 outAmount = _reward.reward;
        uint256 outFluxAmount = _reward.rewardFlux;
        _reward.reward = 0;
        _reward.rewardFlux = 0;
        rewardOut(msg.sender, outAmount, outFluxAmount);
    }
}

contract Vault is Ownable, ERC20, IVault, RewardDistributor {
    ERC20 public override token;
    IHotpotConfig public config;
    mapping(address => int256) public gateAmount;

    constructor(IHotpotConfig _config, ERC20 _token) public ERC20("Vault Token", "VT") {
        config = _config;
        token = _token;
        ERC20._setupDecimals(_token.decimals());
    }

    modifier onlyBound() {
        require(config.boundVault(msg.sender) == address(this), "Vault::onlyBound");
        _;
    }
    modifier update() {
        RewardDistributor.updateReward(msg.sender, ERC20.balanceOf(msg.sender));
        _;
    }

    function rewardOut(
        address to,
        uint256 reward,
        uint256 fluxReward
    ) internal override(RewardDistributor) {
        token.transfer(to, reward);
        config.FLUX().transfer(to, fluxReward);
    }

    function withdrawFund(
        address to,
        uint256 amount,
        uint256 fee,
        uint256 feeFlux
    ) external override onlyBound returns (bool) {
        RewardDistributor.updateIncome(fee, feeFlux, ERC20.totalSupply());
        gateAmount[msg.sender] = gateAmount[msg.sender].sub(int256(amount));
        return token.transfer(to, amount);
    }

    function depositFund(uint256 amount) external override onlyBound {
        token.transferFrom(msg.sender, address(this), amount);
        gateAmount[msg.sender] = gateAmount[msg.sender].add(int256(amount));
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256
    ) internal override(ERC20) {
        if (from != address(0)) RewardDistributor.updateReward(from, ERC20.balanceOf(from));
        if (to != address(0)) RewardDistributor.updateReward(to, ERC20.balanceOf(to));
    }

    function deposit(uint256 amount) external {
        token.transferFrom(msg.sender, address(this), amount);
        ERC20._mint(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        ERC20._burn(msg.sender, amount);
        token.transfer(msg.sender, amount);
    }
}
