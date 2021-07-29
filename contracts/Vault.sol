pragma solidity 0.6.12;

import {IHotpotConfig} from "./HotpotConfig.sol";
import {IVault} from "./interfaces/IVault.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

abstract contract RewardDistributor {
    using SafeMath for uint256;
    using SignedSafeMath for int256;
    struct UserRewards {
        uint256 rewardFluxPerToken;
        uint256 rewardFlux;
    }
    uint256 public rewardFluxPerTokenStored;
    mapping(address => UserRewards) public rewards;

    function updateIncome(uint256 feeFlux, uint256 totalTokens) internal {
        rewardFluxPerTokenStored = rewardFluxPerTokenStored.add(feeFlux.mul(1e18).div(totalTokens));
    }

    function updateReward(address account, uint256 shares) internal {
        UserRewards storage _reward = rewards[account];
        uint256 userRewardFluxPerToken = _reward.rewardFluxPerToken;
        uint256 _rewardFluxPerTokenStored = rewardFluxPerTokenStored;
        if (userRewardFluxPerToken != _rewardFluxPerTokenStored) {
            _reward.rewardFluxPerToken = shares.mul(_rewardFluxPerTokenStored.sub(userRewardFluxPerToken)).div(1e18).add(_reward.rewardFluxPerToken);
            _reward.rewardFluxPerToken = rewardFluxPerTokenStored;
        }
    }

    function rewardOut(address to, uint256 fluxReward) internal virtual;

    function harvest() external {
        UserRewards storage _reward = rewards[msg.sender];
        uint256 outFluxAmount = _reward.rewardFlux;
        _reward.rewardFlux = 0;
        rewardOut(msg.sender, outFluxAmount);
    }
}

interface FToken {
    function borrowToken(
        address token,
        address to,
        uint256 amount
    ) external returns (bool);

    function totalDebt() external view returns (uint256);

    function repayToken(address token, uint256 amount) external;
}

contract Vault is Ownable, ERC20, IVault, RewardDistributor {
    ERC20 public override token;
    FToken public ftoken;
    IHotpotConfig public config;
    mapping(address => int256) public override gateAmount;
    uint256 public totalToken;

    constructor(
        IHotpotConfig _config,
        ERC20 _token,
        FToken _ftoken
    ) public ERC20("Vault Token", "VT") {
        config = _config;
        token = _token;
        ftoken = _ftoken;
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

    function rewardOut(address to, uint256 fluxReward) internal override(RewardDistributor) {
        config.FLUX().transfer(to, fluxReward);
    }

    function borrowToken(
        FToken _ftoken,
        address to,
        uint256 amount
    ) private returns (bool) {
        if (address(_ftoken) != address(0)) {
            uint256 before = token.balanceOf(to);
            // should tranfer token to user
            address(_ftoken).call(abi.encodeWithSelector(ftoken.borrowToken.selector, address(token), to, amount));
            return token.balanceOf(to) == before.add(amount);
        }
        return false;
    }

    function withdrawFund(
        address to,
        uint256 amount,
        uint256 fee,
        uint256 feeFlux
    ) external override onlyBound returns (bool) {
        gateAmount[msg.sender] = gateAmount[msg.sender].sub(int256(amount));
        uint256 cash = token.balanceOf(address(this));
        if (cash >= amount) {
            token.transfer(to, amount);
        } else {
            uint256 diff = cash - amount;
            if (borrowToken(ftoken, to, diff)) {
                //_deposit(address(ftoken), diff);
                if (cash > 0) token.transfer(to, cash);
            } else {
                return false;
            }
        }
        if (fee > 0) totalToken = totalToken.add(fee);
        if (feeFlux > 0) RewardDistributor.updateIncome(feeFlux, ERC20.totalSupply());
        return true;
    }

    function repayToken() public {
        if (address(ftoken) == address(0)) return;
        uint256 debt = ftoken.totalDebt();
        uint256 cash = token.balanceOf(address(this));
        uint256 repayAmount = Math.min(debt, cash);
        if (repayAmount > 0) {
            token.approve(address(ftoken), repayAmount);
            ftoken.repayToken(address(token), repayAmount);
            // require(ftoken.totalDebt() == debt.sub(repayAmount), "repay failed");
        }
    }

    function depositFund(address from, uint256 amount) external override onlyBound {
        token.transferFrom(from, address(this), amount);
        gateAmount[msg.sender] = gateAmount[msg.sender].add(int256(amount));
        repayToken();
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256
    ) internal override(ERC20) {
        if (from != address(0)) RewardDistributor.updateReward(from, ERC20.balanceOf(from));
        if (to != address(0)) RewardDistributor.updateReward(to, ERC20.balanceOf(to));
    }

    function _deposit(address user, uint256 amount) private {
        token.transferFrom(user, address(this), amount);
        uint256 totalSupply = ERC20.totalSupply();
        uint256 share = totalToken == 0 || totalSupply == 0 ? amount : totalSupply.mul(amount).div(totalToken);
        totalToken = totalToken.add(amount);
        ERC20._mint(user, share);
        repayToken();
    }

    function deposit(uint256 amount) external {
        _deposit(msg.sender, amount);
    }

    function _withdraw(address user, uint256 share) private {
        uint256 amount = totalToken.mul(share).div(ERC20.totalSupply());
        totalToken = totalToken.sub(amount);
        ERC20._burn(user, share);
        token.transfer(user, amount);
    }

    function withdraw(uint256 share) external {
        _withdraw(msg.sender, share);
    }
}
