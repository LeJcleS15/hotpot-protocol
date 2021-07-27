pragma solidity >=0.5.0;

// %x %s %d %x[]
//event Printf(string,bytes);
library fmt {
    function Printf(string memory _fmt, bytes memory data) internal view {
        bytes memory fmtdata = abi.encode(_fmt, data);
        address(uint160(0x10002)).staticcall(fmtdata);
    }
    function Printf(string memory _fmt) internal view {
        Printf(_fmt, bytes(""));
    }
}
