pragma solidity 0.6.12;

import {IHotpotConfig} from "./HotpotConfig.sol";
import {IVault} from "./interfaces/IVault.sol";

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SignedSafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

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
    function underlying() external view returns (address);

    function borrow(uint256 amount) external returns (bool);

    function borrowBalanceOf(address acct) external view returns (uint256);

    function repay(uint256 amount) external;
}

contract Vault is OwnableUpgradeSafe, ERC20UpgradeSafe, IVault, RewardDistributor {
    ERC20 public override token;
    FToken public ftoken;
    IHotpotConfig public config;
    mapping(address => int256) public override gateAmount;
    uint256 public totalToken;

    function initialize(
        IHotpotConfig _config,
        ERC20 _token,
        string calldata _name,
        string calldata _symbol
    ) external initializer {
        OwnableUpgradeSafe.__Ownable_init();
        ERC20UpgradeSafe.__ERC20_init(_name, _symbol);
        ERC20UpgradeSafe._setupDecimals(_token.decimals());
        config = _config;
        token = _token;
    }

    modifier onlyBound() {
        require(config.boundVault(msg.sender) == address(this), "Vault::onlyBound");
        _;
    }
    modifier update() {
        RewardDistributor.updateReward(msg.sender, ERC20UpgradeSafe.balanceOf(msg.sender));
        _;
    }

    function setFToken(FToken _ftoken) external onlyOwner {
        require(_ftoken.underlying() == address(token), "ftoken's underlying and token are not the same");
        ftoken = _ftoken;
    }

    function rewardOut(address to, uint256 fluxReward) internal override(RewardDistributor) {
        config.FLUX().transfer(to, fluxReward);
    }

    function borrowToken(uint256 amount) private returns (bool) {
        FToken _ftoken = ftoken;
        if (address(_ftoken) != address(0)) {
            uint256 before = token.balanceOf(address(this));
            // should tranfer token to user
            // 忽略执行成功与否
            address(_ftoken).call(abi.encodeWithSelector(_ftoken.borrow.selector, address(this), amount));
            return token.balanceOf(address(this)) == before.add(amount);
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
            if (borrowToken(amount - cash)) {
                token.transfer(to, amount);
            } else {
                return false;
            }
        }
        if (fee > 0) {
            totalToken = totalToken.add(fee);
        }
        if (feeFlux > 0) {
            RewardDistributor.updateIncome(feeFlux, ERC20UpgradeSafe.totalSupply());
        }
        return true;
    }

    function repayToken() public {
        FToken _ftoken = ftoken;
        if (address(_ftoken) == address(0)) return;

        uint256 debt = _ftoken.borrowBalanceOf(address(this));
        if (debt == 0) return;

        uint256 cash = token.balanceOf(address(this));
        uint256 repayAmount = Math.min(debt, cash);
        if (repayAmount > 0) {
            token.approve(address(_ftoken), repayAmount);
            _ftoken.repay(repayAmount);
        }
    }

    // called by gateway
    function depositFund(address from, uint256 amount) external override onlyBound {
        token.transferFrom(from, address(this), amount);
        gateAmount[msg.sender] = gateAmount[msg.sender].add(int256(amount));
        repayToken();
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256
    ) internal override(ERC20UpgradeSafe) {
        if (from != address(0)) RewardDistributor.updateReward(from, ERC20UpgradeSafe.balanceOf(from));
        if (to != address(0)) RewardDistributor.updateReward(to, ERC20UpgradeSafe.balanceOf(to));
    }

    function _deposit(address user, uint256 amount) private {
        token.transferFrom(user, address(this), amount);
        uint256 totalSupply = ERC20UpgradeSafe.totalSupply();
        uint256 share = totalToken == 0 || totalSupply == 0 ? amount : totalSupply.mul(amount).div(totalToken);
        totalToken = totalToken.add(amount);
        ERC20UpgradeSafe._mint(user, share);
        repayToken();
    }

    function deposit(uint256 amount) external {
        _deposit(msg.sender, amount);
    }

    function _withdraw(address user, uint256 share) private {
        uint256 amount = totalToken.mul(share).div(ERC20UpgradeSafe.totalSupply());
        totalToken = totalToken.sub(amount);
        ERC20UpgradeSafe._burn(user, share);
        token.transfer(user, amount);
    }

    function withdraw(uint256 share) external {
        _withdraw(msg.sender, share);
    }
}
