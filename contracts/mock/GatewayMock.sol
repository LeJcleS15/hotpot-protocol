// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "../Gateway.sol";

contract GatewayMock is Gateway {
    event OnCrossTransfer(uint256 indexed crossId, uint256 indexed status, address indexed to, uint256 amount, uint256 fee, int256 feeFlux);
    event OnCrossTransferWithData(uint256 indexed crossId, uint256 indexed status, address indexed to, uint256 amount, uint256 fee, int256 feeFlux, address from, bytes data);

    function _onCrossTransferExecute(bytes memory data) internal override returns (bool) {
        (uint256 crossId, address to, uint256 metaAmount, uint256 metaFee, int256 _feeFlux) = abi.decode(data, (uint256, address, uint256, uint256, int256));
        CrossStatus status = existedIds[crossId]; // already marked COMPLETE
        bool success = _onCrossTransfer(to, metaAmount, metaFee, _feeFlux);
        CrossStatus newStatus = success ? CrossStatus.COMPLETED : CrossStatus.PENDING;
        if (status == CrossStatus.COMPLETED || status != newStatus) {
            emit OnCrossTransfer(crossId, uint256(newStatus), to, metaAmount, metaFee, _feeFlux);
        }
        return success;
    }

    function _onCrossTransferWithDataExecute(bytes memory data) internal override returns (bool) {
        (uint256 crossId, address to, uint256 metaAmount, uint256 metaFee, int256 _feeFlux, address from, bytes memory extData) = abi.decode(
            data,
            (uint256, address, uint256, uint256, int256, address, bytes)
        );
        CrossStatus status = existedIds[crossId]; // already marked COMPLETE
        bool success = _onCrossTransferWithData(from, to, metaAmount, metaFee, _feeFlux, extData);
        CrossStatus newStatus = success ? CrossStatus.COMPLETED : CrossStatus.PENDING;
        if (status == CrossStatus.COMPLETED || status != newStatus) {
            emit OnCrossTransfer(crossId, uint256(newStatus), to, metaAmount, metaFee, _feeFlux);
        }
        return success;
    }
}
