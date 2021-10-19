const fs = require('fs');

module.exports = (file, path, value, polyId) => {
    const recordFile = process.cwd() + `/${file}`;
    const chainId = polyId || require('hardhat').chainId;
    const record = fs.existsSync(recordFile) ? require(recordFile) : {};
    const chainRecord = record[chainId] || {}
    if (path) {
        const parent = path.slice(0, -1).reduce((node, key) => node[key] = node[key] || {}, chainRecord);
        parent[path.slice(-1)[0]] = value;
        record[chainId] = chainRecord;
        fs.writeFileSync(recordFile, JSON.stringify(record, undefined, '    '));
    }
    chainRecord._path = _path => _path.reduce((node, key) => node && node[key], chainRecord);
    return chainRecord;
}