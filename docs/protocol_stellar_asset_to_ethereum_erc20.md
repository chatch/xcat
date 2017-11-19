# Stellar Assets to Ethereum ERC20 Token Swaps

** DRAFT v0.0.1**

This protocol supports atomic trades/swaps between the tokens on the Stellar and Ethereum networks.

Two scenarios are described below. Scenario 1 is initiated from Stellar and Scenario 2 is initiated from Ethereum.

NOTE:
 * examples trade between a Stellar CNY Asset and an Ethereum OMG token but the goal is to support any combination
 * uses the [HashedTimelockERC20 smart contract](https://github.com/chatch/hashed-timelock-contract-ethereum/blob/ERC20_HTLC/contracts/HashedTimelockERC20.sol) to lock up tokens on Ethereum
 * no consideration given to authorized flag assets yet. the holding account would need auth before continuing the trade OR some other mechanism would be required handle these.
 * support for tokens that implement ERC223 could be added later (advantage being no approve step required - tokens sent in the same transaction as the newContract call transaction)

## Scenario 1 (S1): Swap initiated by Stellar Asset holder

### Summary
* Alice initiates the setup process on Stellar side
* Alice sells CNY to Bob
* Bob sells OMG to Alice

### Sequence Diagram
![sequence Diagram - TODO](uml/protocol-tokens-scenario1.png)

### Protocol

1. Agreement
    1.  Agree to asset types and amounts over some channel (telegram, phone call, whatever ..)
    2.  Exchange Stellar and Ethereum public addresses. Each user must have 1 account on each network
    3.  Define this in a trade.json file [JSON schema](https://github.com/chatch/xcat/blob/master/src/schema/trade.json)
    4.  Ensure Bob already has a trustline to the Stellar Asset before proceeding.
2. Setup
    1. Alice generates secret x
    2. [Stellar] Alice submits Tx:
      Operation: Create Account
                    Destination: hold acc
                    Balance: 50 (includes +10 for hash(x) signer, +10 for Bob signer, +10 for CNY trustline)
      Operation: Allow Trust:
                    Source: hold acc
                    Line: CNY / CNY Issuer
                    Limit: agreed amount 
      Operation: Set Options:
                    Source: hold acc
                    Signers: Bob w/ weight 1
      Operation: Set Options:
                    Source: hold acc
                    Master Weight:    0
                    Threshold(ALL Levels): 2
                    Signers: hash(x) w/ weight 1
      Signatures: Alice, hold account
    ```
      
    3. [Stellar] Bob creates and signs tx envelope for a refund tx for Alice and sends it to her:
    ```
    Source: holding account
      Time bound: 6h from now
      Sequence: holding account current sequence
      Operation: Account Merge
        Destination: Alice
      Signatures: Bob
    ```

    4. [Stellar] Alice submits TX moving agreed CNY amount into the holding account:
    ```
      Source: Alice
      Operation: Payment to Holding Account
        Amount: agreed amount of CNY
    ```

    5. [Ethereum] Bob calls newContract() on HashedTimelockERC20 Ethereum contract:
    ```
      receiver = Alices Ethereum address
      hashLock = hash(x)
      timelock = 6h from now
      token = OMG token contract address
      amount = agreed OMG amount
    ```
3. Exchange
    1. [Ethereum] Alice calls withdraw() on the contract revealing x
       calls transfer on the OMG token contract transfering change ownership for 'amount' tokens to Alice

    2. [Stellar] Bob now knows x and submits a TX to Stellar to get funds:
    ```
      Source: Holding Account
      Operation: Account Merge
        Destination: Bob
      Signatures: bob, x
    ```

NOTES:
1. If nothing happens after 2.4 Alice can get a refund after 'Time Bound' time has passed by adding a signature x to the transaction Bob gave here in 2.3
2. If nothing happens after 2.5 Bob can get a refund after timelock time has passed by calling refund() on the Ethereum smart contract


## Scenario 2 (S2): Swap initiated by OMG holder on Ethereum

### Summary
* Bob initiates the setup process on Ethereum side
* Alice sells CNY to Bob
* Bob sells OMG to Alice

### Protocol

TODO!
