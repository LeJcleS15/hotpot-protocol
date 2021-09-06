// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "../Gateway.sol";

contract GatewayMock is Gateway {
    event OnCrossTransferMock(uint256 indexed crossId, uint256 indexed status, address indexed to, uint256 amount, uint256 fee, int256 feeFlux);

    //event OnCrossTransferWithData(uint256 indexed crossId, uint256 indexed status, address indexed to, uint256 amount, uint256 fee, int256 feeFlux, address from, bytes data);

    function _onCrossTransferExecute(bytes memory data) internal override {
        (uint256 crossId, address to, uint256 metaAmount, uint256 metaFee, int256 _feeFlux) = abi.decode(data, (uint256, address, uint256, uint256, int256));
        _onCrossTransfer(to, metaAmount, metaFee, _feeFlux);
        emit OnCrossTransferMock(crossId, uint256(CrossStatus.COMPLETED), to, metaAmount, metaFee, _feeFlux);
    }

    function _onCrossTransferWithDataExecute(bytes memory data) internal override {
        (uint256 crossId, address to, uint256 metaAmount, uint256 metaFee, int256 _feeFlux, address from, bytes memory extData) = abi.decode(
            data,
            (uint256, address, uint256, uint256, int256, address, bytes)
        );
        _onCrossTransferWithData(from, to, metaAmount, metaFee, _feeFlux, extData);
        emit OnCrossTransferMock(crossId, uint256(CrossStatus.COMPLETED), to, metaAmount, metaFee, _feeFlux);
    }
}
