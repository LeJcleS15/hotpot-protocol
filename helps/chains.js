const fs = require('fs');

module.exports = (file, _chainId = undefined) => {
    const hre = require('hardhat');
    const { ethers } = hre;

    const recordFile = process.cwd() + `/${file}`;
    const chainId = _chainId || hre.chainId;
    const record = fs.existsSync(recordFile) ? require(recordFile) : {};
    const keys = Object.keys(record);
    const values = Object.values(record);
    const indexOf = values.findIndex(r => r.chainId == chainId);
    if (indexOf < 0) throw `chain not found: ${recordFile} ${chainId}`;

    const chainRecord = { ...values[indexOf] };
    chainRecord._path = _path => _path.reduce((node, key) => node && node[key], chainRecord);
    chainRecord._raw = record;
    chainRecord._name = keys[indexOf];
    chainRecord._toPolyId = _chainId => values.find(r => r.chainId == _chainId).polyId;
    chainRecord._toChainId = _polyId => values.find(r => r.polyId == _polyId).chainId;
    chainRecord._toName = chainId => keys[values.findIndex(r => r.chainId == chainId)];
    chainRecord._polyToName = polyId => keys[values.findIndex(r => r.polyId == polyId)];
    return chainRecord;
}