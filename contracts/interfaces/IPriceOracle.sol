// SPDX-License-Identifier: MIT
// Created by Flux Team

pragma solidity 0.6.12;

/**
    @title 价格预言机
 */
interface IPriceOracle {
    ///@notice 价格变动事件
    event PriceChanged(address token, uint256 oldPrice, uint256 newPrice);

    /**
      @notice 获取资产的价格
      @param token 资产
      @return uint256 资产价格（尾数）
     */
    function getPriceMan(address token) external view returns (uint256);
}
