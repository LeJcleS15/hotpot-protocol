curl --location --request POST 'https://bridge.poly.network/v1/getfee/' \
--data-raw '{
    "SrcChainId": 7, 
    "Hash": "0000000000000000000000000000000000000000", 
    "SwapTokenHash": "0000000000000000000000000000000000000000", 
    "DstChainId": 2
}'
