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

    function updateIncome(uint256 feeFlux, uint256 totalShares) internal {
        uint256 reserved = totalShares == 0 ? feeFlux : feeFlux.mul(RESERVED_POINT).div(RESERVED_DENOM);
        reservedFeeFlux = reservedFeeFlux.add(reserved);
        uint256 remain = feeFlux.sub(reserved);
        if (remain > 0) rewardFluxPerShareStored = rewardFluxPerShareStored.add(remain.mul(1e18).div(totalShares));
    }

    function updateReward(address account, uint256 shares) internal {
        UserRewards storage _reward = rewards[account];
        uint256 userrewardFluxPerShare = _reward.rewardFluxPerShare;
        uint256 _rewardFluxPerShareStored = rewardFluxPerShareStored;
        if (userrewardFluxPerShare != _rewardFluxPerShareStored) {
            _reward.rewardFluxPerShare = shares.mul(_rewardFluxPerShareStored.sub(userrewardFluxPerShare)).div(1e18).add(_reward.rewardFluxPerShare);
            _reward.rewardFluxPerShare = rewardFluxPerShareStored;
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

contract Vault is OwnableUpgradeSafe, ERC20UpgradeSafe, IVault, RewardDistributor {
    using SafeERC20 for IERC20;
    IERC20 public override token;
    IFToken public ftoken;
    IConfig public config;
    mapping(address => int256) public override gateDebt;
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

    function rewardOut(address to, uint256 fluxReward) internal override(RewardDistributor) {
        config.FLUX().safeTransfer(to, fluxReward);
    }

    function borrowToken(uint256 amount) private returns (bool) {
        IFToken _ftoken = ftoken;
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
        gateDebt[msg.sender] = gateDebt[msg.sender].sub(int256(amount.add(fee)));
        uint256 cash = token.balanceOf(address(this));
        if (cash >= amount) {
            token.safeTransfer(to, amount);
        } else {
            if (borrowToken(amount - cash)) {
                token.safeTransfer(to, amount);
            } else {
                return false;
            }
        }
        uint256 totalShares = ERC20UpgradeSafe.totalSupply();
        if (fee > 0) {
            uint256 reserved = totalShares == 0 ? fee : fee.mul(RewardDistributor.RESERVED_POINT).div(RewardDistributor.RESERVED_DENOM);
            RewardDistributor.reservedFee = RewardDistributor.reservedFee.add(reserved);
            uint256 remain = fee.sub(reserved);
            if (remain > 0) totalToken = totalToken.add(remain);
        }
        if (feeFlux > 0) {
            RewardDistributor.updateIncome(feeFlux, totalShares);
        }
        return true;
    }

    function repayToken() public {
        IFToken _ftoken = ftoken;
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
        token.safeTransferFrom(from, address(this), amount);
        gateDebt[msg.sender] = gateDebt[msg.sender].add(int256(amount));
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
        token.safeTransferFrom(user, address(this), amount);
        uint256 totalShares = ERC20UpgradeSafe.totalSupply();
        uint256 share = totalToken == 0 ? amount : totalShares.mul(amount).div(totalToken);
        totalToken = totalToken.add(amount);
        ERC20UpgradeSafe._mint(user, share);
        repayToken();
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
}
