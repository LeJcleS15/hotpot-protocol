// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

library chainIds {
    function toChainId(uint64 polyId) internal pure returns (uint256) {
        if (polyId == 12) return 66; // OEC
        if (polyId == 7) return 128; // HECO
        if (polyId == 6) return 56; // BSC
        if (polyId == 2) return 1; // ETH
        revert("unsupported polyId");
    }

    function toPolyId(uint256 chainId) internal pure returns (uint64 polyId) {
        if (chainId == 66) return 12; // OEC
        if (chainId == 128) return 7; // HEC
        if (chainId == 56) return 6; // BSC
        if (chainId == 1) return 2; // ETH
        revert("unsupported chainId");
    }
}
