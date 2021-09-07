// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SignedSafeMath.sol";
import {ERC20UpgradeSafe} from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";

import {IConfig} from "./Config.sol";
import {IVault} from "./interfaces/IVault.sol";
import {IFToken} from "./interfaces/IFToken.sol";

abstract contract RewardDistributor {
    using SafeMath for uint256;
    using SignedSafeMath for int256;
    struct UserRewards {
        uint256 rewardFluxPerShare;
        uint256 rewardFlux;
    }
    uint256 public rewardFluxPerShareStored;
    mapping(address => UserRewards) public rewards;
    uint256 public reservedFeeFlux;
    uint256 public reservedFee;
    uint256 public constant RESERVED_POINT = 3000;
    uint256 public constant RESERVED_DENOM = 10000;
    uint256 private constant PER_SHARE_SACLE = 1e18;

    function updateIncome(uint256 feeFlux, uint256 totalShares) internal {
        uint256 reserved = totalShares == 0 ? feeFlux : feeFlux.mul(RESERVED_POINT).div(RESERVED_DENOM);
        uint256 remain = feeFlux.sub(reserved); // if `totalShares` is zero, `remain` is also zero
        if (remain > 0) {
            uint256 deltaPerShare = remain.mul(PER_SHARE_SACLE).div(totalShares);
            rewardFluxPerShareStored = rewardFluxPerShareStored.add(deltaPerShare);
            uint256 tiny = remain.sub(deltaPerShare.mul(totalShares).div(PER_SHARE_SACLE));
            reserved = reserved.add(tiny);
        }
        reservedFeeFlux = reservedFeeFlux.add(reserved);
    }

    function pendingReward(address account, uint256 shares) internal view returns (uint256) {
        UserRewards storage _reward = rewards[account];
        uint256 userrewardFluxPerShare = _reward.rewardFluxPerShare;
        uint256 _rewardFluxPerShareStored = rewardFluxPerShareStored;
        return shares.mul(_rewardFluxPerShareStored.sub(userrewardFluxPerShare)).div(PER_SHARE_SACLE).add(_reward.rewardFlux);
    }

    function updateReward(address account, uint256 shares) internal {
        UserRewards storage _reward = rewards[account];
        uint256 userrewardFluxPerShare = _reward.rewardFluxPerShare;
        uint256 _rewardFluxPerShareStored = rewardFluxPerShareStored;
        if (userrewardFluxPerShare != _rewardFluxPerShareStored) {
            _reward.rewardFlux = shares.mul(_rewardFluxPerShareStored.sub(userrewardFluxPerShare)).div(PER_SHARE_SACLE).add(_reward.rewardFlux);
            _reward.rewardFluxPerShare = rewardFluxPerShareStored;
        }
    }

    function harvest(address account) internal returns (uint256) {
        UserRewards storage _reward = rewards[account];
        uint256 outFluxAmount = _reward.rewardFlux;
        _reward.rewardFlux = 0;
        return outFluxAmount;
    }
}

contract Vault is OwnableUpgradeSafe, ERC20UpgradeSafe, IVault, RewardDistributor {
    using SafeERC20 for IERC20;
    IERC20 public override token;
    IFToken public ftoken;
    IConfig public override config;
    struct GateDebt {
        int256 debt;
        int256 debtFlux;
    }
    mapping(address => GateDebt) public override gateDebt;
    uint256 public totalToken;

    // totalToken == cash - sum(gateDebt) - reservedFee

    function initialize(
        IConfig _config,
        IERC20 _token,
        string calldata _name,
        string calldata _symbol
    ) external initializer {
        OwnableUpgradeSafe.__Ownable_init();
        ERC20UpgradeSafe.__ERC20_init(_name, _symbol);
        ERC20UpgradeSafe._setupDecimals(ERC20UpgradeSafe(address(_token)).decimals());
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

    function setFToken(IFToken _ftoken) external onlyOwner {
        require(_ftoken.underlying() == address(token), "ftoken's underlying and token are not the same");
        ftoken = _ftoken;
    }

    function pendingReward(address account) external view returns (uint256) {
        return RewardDistributor.pendingReward(account, ERC20UpgradeSafe.balanceOf(account));
    }

    function harvest() external update {
        uint256 reward = RewardDistributor.harvest(msg.sender);
        config.FLUX().safeTransfer(msg.sender, reward);
    }

    function _borrowToken(uint256 amount) private {
        ftoken.borrow(amount);
    }

    function repayToken() external {
        IFToken _ftoken = ftoken;
        //if (address(_ftoken) == address(0)) return;

        uint256 debt = _ftoken.borrowBalanceOf(address(this));
        if (debt == 0) return;

        uint256 cash = token.balanceOf(address(this));
        uint256 repayAmount = Math.min(debt, cash);
        if (repayAmount > 0) {
            token.approve(address(_ftoken), repayAmount);
            _ftoken.repay(repayAmount);
        }
    }

    function withdrawFund(
        address to,
        uint256 amount,
        uint256 fee,
        int256 feeFlux
    ) external override onlyBound {
        GateDebt storage debt = gateDebt[msg.sender];
        debt.debt = debt.debt.sub(int256(amount.add(fee)));
        uint256 cash = token.balanceOf(address(this));
        if (cash < amount) _borrowToken(amount - cash);
        token.safeTransfer(to, amount);

        uint256 totalShares = ERC20UpgradeSafe.totalSupply();
        if (fee > 0) {
            uint256 reserved = totalShares == 0 ? fee : fee.mul(RewardDistributor.RESERVED_POINT).div(RewardDistributor.RESERVED_DENOM);
            RewardDistributor.reservedFee = RewardDistributor.reservedFee.add(reserved);
            uint256 remain = fee.sub(reserved);
            if (remain > 0) totalToken = totalToken.add(remain);
        }
        if (feeFlux > 0) {
            // 跨链手续费
            debt.debtFlux = debt.debtFlux.sub(feeFlux);
            RewardDistributor.updateIncome(uint256(feeFlux), totalShares);
        } else if (feeFlux < 0) {
            // 表示调仓
            debt.debtFlux = debt.debtFlux.add(feeFlux); // add负数
            config.FLUX().safeTransfer(to, uint256(-feeFlux));
        }
    }

    // called by gateway
    function depositFund(
        address from,
        uint256 amount,
        uint256 feeFlux
    ) external override onlyBound {
        GateDebt storage debt = gateDebt[msg.sender];
        token.safeTransferFrom(from, address(this), amount);
        if (feeFlux > 0) {
            config.FLUX().safeTransferFrom(from, address(this), feeFlux);
            debt.debtFlux = debt.debtFlux.add(int256(feeFlux));
        }
        debt.debt = debt.debt.add(int256(amount));
        //repayToken();
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
        token.safeTransferFrom(user, address(this), amount);
        uint256 totalShares = ERC20UpgradeSafe.totalSupply();
        uint256 share = totalToken == 0 ? amount : totalShares.mul(amount).div(totalToken);
        totalToken = totalToken.add(amount);
        ERC20UpgradeSafe._mint(user, share);
        //repayToken();
    }

    function deposit(uint256 amount) external {
        _deposit(msg.sender, amount);
    }

    function _withdraw(address user, uint256 share) private {
        uint256 totalShares = ERC20UpgradeSafe.totalSupply();
        uint256 amount = totalToken.mul(share).div(totalShares);
        totalToken = totalToken.sub(amount);
        ERC20UpgradeSafe._burn(user, share);
        token.safeTransfer(user, amount);
    }

    function withdraw(uint256 share) external {
        _withdraw(msg.sender, share);
    }

    function withdrawReserved(address to) external onlyOwner {
        uint256 fee = RewardDistributor.reservedFee;
        uint256 feeFlux = RewardDistributor.reservedFeeFlux;
        if (fee > 0) {
            RewardDistributor.reservedFee = 0;
            token.safeTransfer(to, fee);
        }
        if (feeFlux > 0) {
            RewardDistributor.reservedFeeFlux = 0;
            config.FLUX().safeTransfer(to, feeFlux);
        }
    }
}
