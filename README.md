# Hotpot Lossless Bridge
Hotpot is a cross chain lossless bridge.
## installation
run `yarn` or `npm install`
## test
### 1. start two ganache-cli
```
ganache-cli -p 11000 --chainId=1000 --account_keys_path=/tmp/1000.json
```
```
ganache-cli -p 12000 --chainId=2000 --account_keys_path=/tmp/2000.json
```
### 2. deploy and init contracts
```
./tools/init.sh
```
```
node tools/relayer.js
```