// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

contract Bits {
    function countSetBits(uint256 bitmap) external pure returns (uint256) {
        uint256 count = 0;
        while (bitmap > 0) {
            bitmap &= (bitmap - 1);
            count++;
        }
        return count;
    }
}
