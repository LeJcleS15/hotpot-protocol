// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../Vault.sol";
import "../Gateway.sol";

contract HotpotLens {
    struct VaultMeta {
        address token;
        uint256 shares;
        uint256 cash;
        uint256 totalToken;
        uint256 rewardFluxPerShareStored;
        uint256 tokenPrice;
        uint256 fluxPrice;
    }

    function getVaultMeta(Vault vault) public view returns (VaultMeta memory) {
        IERC20 token = vault.token();
        IConfig config = vault.config();
        //IERC20 flux = config.FLUX();
        (uint256 tokenPrice, uint256 fluxPrice) = config.feePrice(address(token));
        return VaultMeta({token: address(token), shares: vault.totalSupply(), cash: token.balanceOf(address(vault)), totalToken: vault.totalToken(), rewardFluxPerShareStored: vault.rewardFluxPerShareStored(), tokenPrice: tokenPrice, fluxPrice: fluxPrice});
    }

    function getAllVaultsMeta(Vault[] calldata vaults) external view returns (VaultMeta[] memory) {
        VaultMeta[] memory metas = new VaultMeta[](vaults.length);
        for (uint256 i = 0; i < vaults.length; i++) {
            metas[i] = getVaultMeta(vaults[i]);
        }
        return metas;
    }

    struct GatewayMeta {
        address token;
        uint64 remotePolyId;
        address remoteGateway;
        uint256 fee;
        address vault;
        uint256 pendingLength;
        int256 balance;
        uint256 vaultCash;
        uint256 tokenPrice;
        uint256 fluxPrice;
        uint256 bindStatus;
    }

    function getGatewayMeta(Gateway gateway) public view returns (GatewayMeta memory) {
        IERC20 token = gateway.token();
        IVault vault = gateway.vault();
        IConfig config = gateway.config();
        //IERC20 flux = config.FLUX();
        (uint256 tokenPrice, uint256 fluxPrice) = config.feePrice(address(token));
        return GatewayMeta({token: address(token), remotePolyId: gateway.remotePolyId(), remoteGateway: gateway.remoteGateway(), fee: gateway.fee(), vault: address(vault), pendingLength: gateway.pendingLength(), balance: vault.gateAmount(address(gateway)), vaultCash: token.balanceOf(address(vault)), tokenPrice: tokenPrice, fluxPrice: fluxPrice, bindStatus: uint256(gateway.bindStatus())});
    }

    function getAllGatewaysMeta(Gateway[] calldata gateways) external view returns (GatewayMeta[] memory) {
        GatewayMeta[] memory metas = new GatewayMeta[](gateways.length);
        for (uint256 i = 0; i < gateways.length; i++) {
            metas[i] = getGatewayMeta(gateways[i]);
        }
        return metas;
    }
}
