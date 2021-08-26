// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IGateway} from "./interfaces/IGateway.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

contract Router is Ownable, ReentrancyGuard, Pausable {
    using SafeMath for uint256;
    struct Gas {
        uint256 gasLimit;
        uint256 gasPrice;
    }

    address public feeCollector;
    mapping(uint64 => Gas) public gas;
    IPriceOracle public oracle;
    address public wnative;

    constructor(IPriceOracle _oracle, address _wnative) public {
        oracle = _oracle;
        wnative = _wnative;
    }

    receive() external payable {}

    function setGas(
        uint64[] calldata polyIds,
        uint256[] calldata gasLimit,
        uint256[] calldata gasPrice
    ) external onlyOwner {
        for (uint256 i = 0; i < polyIds.length; i++) {
            gas[polyIds[i]] = Gas(gasLimit[i], gasPrice[i]);
        }
    }

    function setFeeCollector(address collector) external onlyOwner {
        require(collector != address(0), "emtpy address");
        feeCollector = collector;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function getFeeNative(uint64 polyId) public view returns (uint256) {
        uint256 remotePrice = oracle.getPriceMan(address(uint160(polyId)));
        uint256 nativePrice = oracle.getPriceMan(wnative);
        Gas storage _gas = gas[polyId];
        return (((_gas.gasLimit * _gas.gasPrice * remotePrice) / nativePrice) * 120) / 100;
    }

    function crossTransfer(
        IGateway gate,
        address to,
        uint256 amount,
        uint256 maxFluxFee
    ) external payable nonReentrant whenNotPaused {
        uint256 fee = getFeeNative(gate.remotePolyId());
        require(msg.value >= fee, "fee too low");
        gate.crossTransferFrom(msg.sender, to, amount, maxFluxFee);
    }

    function crossTransfer(
        IGateway gate,
        address to,
        uint256 amount,
        uint256 maxFluxFee,
        bytes calldata data
    ) external payable nonReentrant whenNotPaused {
        uint256 fee = getFeeNative(gate.remotePolyId());
        require(msg.value >= fee, "fee too low");
        gate.crossTransferFrom(msg.sender, to, amount, maxFluxFee, data);
    }

    function crossRebalance(
        IGateway gate,
        address to,
        uint256 amount,
        uint256 fluxAmount
    ) external payable nonReentrant whenNotPaused {
        //uint256 fee = getFeeNative(gate.remotePolyId());
        //require(msg.value >= fee, "fee too low");
        gate.crossRebalanceFrom(msg.sender, to, amount, fluxAmount);
    }

    function extractFee(address) external whenNotPaused {
        require(msg.sender == feeCollector, "!feeCollector");
        payable(msg.sender).transfer(address(this).balance);
    }
}
