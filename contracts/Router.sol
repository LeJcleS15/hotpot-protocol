pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IHotpotGate.sol";

contract HotpotRouter is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address public feeCollector;

    function crossTransfer(
        IHotpotGate gate,
        address to,
        uint256 amount,
        uint256 maxFluxFee
    ) external payable {
        gate.crossTransferFrom(msg.sender, to, amount, maxFluxFee);
    }

    function crossRebalance(
        IHotpotGate gate,
        address to,
        uint256 amount
    ) external payable {
        gate.crossRebalanceFrom(msg.sender, to, amount);
    }

    function setFeeCollector(address collector) external onlyOwner {
        require(collector != address(0), "emtpy address");
        feeCollector = collector;
    }

    function extractFee(address) external {
        require(msg.sender == feeCollector, "!feeCollector");
        payable(msg.sender).transfer(address(this).balance);
    }
}
