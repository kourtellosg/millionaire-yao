// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.8.2 <0.9.0;

import "fhevm/lib/TFHE.sol";
import "fhevm/abstracts/Reencrypt.sol";
import "fhevm/oracle/OracleCaller.sol";
import "fhevm/oracle/lib/Oracle.sol";

/*
Two millionaires Alice and Bob both want to know who is richer between the two,
without revealing each other’s wealth to anyone  (not even between themselves).
The objective is to help Alice and Bob finally settle the argument on who’s
likely to buy a yacht first!
*/
contract MillionaireYao is Reencrypt, OracleCaller {
    address public alice;
    address public bob;

    bool public aliceWealthSubmitted;
    bool public bobWealthSubmitted;

    euint64 internal aliceWealth;
    euint64 internal bobWealth;

    bool internal _isAliceWealthier;
    bool internal _wealthCheck;

    constructor(address _alice, address _bob) {
        alice = _alice;
        bob = _bob;
    }

    function _submitAliceWealth(bytes calldata encryptedAmount) internal {
        require(!aliceWealthSubmitted, "Alice's wealth already submitted");
        aliceWealth = TFHE.asEuint64(encryptedAmount);
        aliceWealthSubmitted = true;
    }

    function _submitBobWealth(bytes calldata encryptedAmount) internal {
        require(!bobWealthSubmitted, "Bob's wealth already submitted");
        bobWealth = TFHE.asEuint64(encryptedAmount);
        bobWealthSubmitted = true;
    }

    function submitWealth(bytes calldata encryptedAmount) public {
        require(alice == msg.sender || bob == msg.sender, "Only Alice or Bob can submit wealth");
        if (msg.sender == alice) {
            _submitAliceWealth(encryptedAmount);
        } else {
            _submitBobWealth(encryptedAmount);
        }
    }

    function wealthOf(
        address wallet,
        bytes32 publicKey,
        bytes calldata signature
    ) public view onlySignedPublicKey(publicKey, signature) returns (bytes memory) {
        require(wallet == msg.sender, "User cannot reencrypt a non-owned wallet wealth");
        if (msg.sender == alice) {
            return TFHE.reencrypt(aliceWealth, publicKey, 0);
        } else if (msg.sender == bob) {
            return TFHE.reencrypt(bobWealth, publicKey, 0);
        } else {
            revert("Wallet requested is not Alice nor Bob");
        }
    }

    function wealthCheck() public {
        require(aliceWealthSubmitted && bobWealthSubmitted, "One of Alice or Bob did not submit their wealth");
        require(!_wealthCheck, "Wealth check already performed");
        ebool[] memory cts = new ebool[](1);
        cts[0] = TFHE.gt(aliceWealth, bobWealth);
        Oracle.requestDecryption(cts, this.isAliceWealthierCallback.selector, 0, block.timestamp + 100);
    }

    function isAliceWealthierCallback(uint256 /*requestID*/, bool decryptedInput) public onlyOracle returns (bool) {
        _isAliceWealthier = decryptedInput;
        _wealthCheck = true;
        return _isAliceWealthier;
    }

    function isBobWealthier() public view returns (bool) {
        require(_wealthCheck, "Wealth is not checked");
        return !_isAliceWealthier;
    }

    function isAliceWealthier() public view returns (bool) {
        require(_wealthCheck, "Wealth is not checked");
        return _isAliceWealthier;
    }
}
