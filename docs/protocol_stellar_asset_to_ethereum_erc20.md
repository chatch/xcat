# Stellar Assets to Ethereum ERC20 Cross-chain Trades

Version: 0.1.3

This protocol supports atomic cross-chain trades between any
[Stellar Asset](https://www.stellar.org/developers/guides/concepts/assets.html)
and any 
[Ethereum ERC20 token](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20-token-standard.md).
It is a variation of the
[Stellar XLM to Ethereum ETH Cross-chain Trades protocol](./protocol_stellar_xlm_to_ethereum_eth.md).


A list of Stellar Assets can be found [here](https://stellar.expert/explorer/asset)
and a list of Ethereum tokens [here](https://etherscan.io/tokens). 
Trades between any pair should be possible with this protocol.


Two scenarios are described below:
* Scenario 1 is initiated from Stellar.
* Scenario 2 is initiated from Ethereum.

### Note

* all hashes are SHA-2 SHA-256 hashes
* HashedTimelockERC20 refers to [this Ethereum smart contract](https://github.com/chatch/hashed-timelock-contract-ethereum/blob/master/contracts/HashedTimelockERC20.sol)
* 'Preimage' and 'x' are used interchangeably to refer to the generated secret preimage, the hash of which is used as the hashlock
* 'HTLC' refers to Hashed Timelock Contracts
* no consideration yet given to Stellar assets with the authorized flag set to true. 
the holding account would need auth before continuing the trade so that would
need to be established at the beginning.
* ERC223 token support could be added (the advantage being no approve()
step would be required)

## Scenario 1 (S1): Trade initiated by Stellar CNY Asset holder

### Summary

* Alice is selling CNY to Bob (CNY is a Chinese Renminbi Asset on Stellar)
* Bob is selling OMG to Alice (OMG is the OmiseGo ERC20 token)
* Alice initiates the setup process creating the secret preimage x
* Alice creates a holding account on Stellar to hold the CNY Asset
* Bob creates a new HTLC on the Ethereum HashedTimelockERC20 contract to hold the ETH
* Alice claims OMG revealing x to the HTLC contract on Ethereum
* Bob takes the revealed x and claims CNY from the Stellar holding account

### Sequence Diagram

![sequence Diagram - TODO](uml/protocol-tokens-scenario1.png)

### Protocol

1. Agreement
   1. Agree to asset types and amounts over some channel (telegram, phone call, whatever ..).
   2. Exchange Stellar and Ethereum public addresses. Each user must have 1 account on each network.
   3. Define trade details in a trade.json file that conforms to the [JSON schema](https://github.com/chatch/xcat/blob/master/src/schema/trade.json)
2. Setup
   1. Alice generates secret x
   2. [Stellar] Alice generates a new address for the holding account
   3. [Stellar] Alice creates the holding account submitting this transaction:
   ```yaml
     source: Alice
     sequence: Alice account sequence
     operations:
       - type: createAccount
         destination: holdingAccount
         balance: 5 * base_reserve     # 5 = 2 + signer hashx + signer bob + asset trustline
       - type: changeTrust
         source: holdingAccount
         asset: CNY Asset
         limit: agreed amount
       - type: setOptions
         source: holdingAccount
         signer:
           - ed25519PublicKey: Bob
           - weight: 1
       - type: setOptions
         source: holdingAccount
         masterWeight: 0
         lowThreshold: 2
         medThreshold: 2
         highThreshold: 2
         signer:
           - sha256Hash: hash(x)
           - weight: 1
     sign: Alice
     sign: holdingAccount
   ```

   4. [Stellar] Bob creates a refund transaction, signs the envelope and sends it to Alice:
   ```yaml
     source: holdingAccount
     sequence: holdingAccount sequence
     timebounds:
       - minTime: N minutes
       - maxTime: 0
     operations:
       - type: accountMerge
         destination: Alice
     sign: Bob
   ```

   5. [Stellar] Alice submits TX moving agreed CNY amount into the holding account:
   ```yaml
     source: Alice
     sequence: Alice's sequence
     operations:
       - type: payment
         destination: holdingAccount
         asset: CNY Asset
         amount: agreed amount
     sign: Alice
   ```

   6. [Ethereum] Bob calls newContract() on HashedTimelockERC20 Ethereum contract:
   ```yaml
    newContract:
      - _receiver: Alice's address (Ethereum)
        _hashlock: hash(x)
        _timelock: N / 2 minutes                       # N from 4. above
        _token: OMGTokenContractAddress
        _amount: agreed amount
   ```

3. Trade
   1. [Ethereum] Alice calls withdraw() on the HTLC revealing x
      The HTLC then calls transfer() on the OMG token contract transferring 
      ownership of the tokens to Alice.
   2. [Stellar] Bob now knows x and submits a TX to Stellar to get funds:
   ```yaml
     source: holdingAccount
     sequence: holdingAccount sequence
     operations:
       - type: accountMerge
         destination: Bob
     sign: Bob
     signHashX: x
   ```

NOTES:

1. If nothing happens after 2.4 Alice can get a refund after 'Time Bound' time 
has passed by adding a signature x to the transaction Bob gave here in 2.3.
2. If nothing happens after 2.5 Bob can get a refund after timelock time has 
passed by calling refund() on the Ethereum smart contract.

## Scenario 2 (S2): Trade initiated by OMG holder on Ethereum

### Summary

* Bob initiates the setup process on Ethereum side
* Alice sells CNY to Bob
* Bob sells OMG to Alice

### Protocol

TODO!
