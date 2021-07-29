// SPDX-License-Identifier: MIT
// Created by Flux Team

pragma solidity 0.6.12;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "../interfaces/IPriceOracle.sol";

/**
    @title Demo测试预言机，线上将使用V1已部署的版本
 */
contract SimplePriceOracle is IPriceOracle {
    ///@notice 各借贷市场的价格信息
    mapping(address => Underlying) public prices;

    struct Underlying {
        uint256 lastUpdate;
        uint256 lastPriceMan;
    }

    /**
      @notice 获取指定借贷市场中资产的价格
      @param token 资产
     */
    function getPriceMan(address token) external view override returns (uint256) {
        return prices[token].lastPriceMan;
    }

    function getLastPriceMan(address token) external view override returns (uint256, uint256) {
        return (prices[token].lastPriceMan, prices[token].lastUpdate);
    }

    /**
     * @notice 设置标的资产价格
     * @param token 标的资产
     * @param priceMan 标的资产的 USDT 价格，价格精准到 18 位小数。
     * @dev 注意，这里的 priceMan 是指一个资产的价格，类似于交易所中的价格。
     *  如 一个比特币价格为 10242.04 USDT，那么此时 priceMan 为 10242.04 *1e18
     */
    function _setPrice(address token, uint256 priceMan) private {
        Underlying storage info = prices[token];
        require(priceMan > 0, "ORACLE_INVALID_PRICE");
        uint256 old = info.lastPriceMan;
        info.lastUpdate = block.timestamp;
        info.lastPriceMan = priceMan;
        emit PriceChanged(token, old, priceMan);
    }

    function setPrice(address token, uint256 priceMan) external {
        _setPrice(token, priceMan);
    }

    function batchSetPrice(address[] calldata tokens, uint256[] calldata priceMans) external {
        require(tokens.length == priceMans.length, "ORACLE_INVALID_ARRAY");
        uint256 len = tokens.length;
        // ignore length check
        for (uint256 i = 0; i < len; i++) {
            _setPrice(tokens[i], priceMans[i]);
        }
    }
}
