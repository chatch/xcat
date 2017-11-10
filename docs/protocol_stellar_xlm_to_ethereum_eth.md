# Stellar XLM to Ethereum ETH Token Swaps

** DRAFT v0.1.2**

This protocol supports atomic trades/swaps between the native tokens of Stellar and Ethereum.

See (protocol_stellar_asset_to_ethereum_erc20.md) for Stellar Asset to Ethereum ERC20 swaps.

Two scenarios are described below. Scenario 1 is initiated from Stellar and Scenario 2 is initiated from Ethereum.


## Scenario 1 (S1): Swap initiated by XLM holder on Stellar

Summary:
* Alice initiates the setup process on Stellar side
* Alice sells XLM to Bob
* Bob sells ETH to Alice

Protocol:

1. Agreement
    1.  Agree to terms over some channel (telegram, phone call, whatever ..) and define the amounts to trade
    2.  Exchange Stellar and Ethereum public addresses. Each user must have 1 account on each network
    3.  Define this in a trade.json file [JSON schema](https://github.com/chatch/xcat/blob/master/src/schema/trade.json)
2. Setup
    1. Alice generates secret x
    2. [Stellar] Alice submits Tx [see in Laboratory](https://www.stellar.org/laboratory/#txbuilder?params=eyJhdHRyaWJ1dGVzIjp7InNvdXJjZUFjY291bnQiOiJHQ09DRDJTVkJFT0I0UFdNUzdGRU9GTTI3VFBTWkJPNUxGUjI0TkJNVDZRNzNPSVVLQktES0ZCUyIsInNlcXVlbmNlIjoiMTcxNzY2NTIyNTM0OTUyOTgifSwib3BlcmF0aW9ucyI6W3siaWQiOjAsImF0dHJpYnV0ZXMiOnsic3RhcnRpbmdCYWxhbmNlIjoiNDAiLCJkZXN0aW5hdGlvbiI6IkdEWFpaRzJJS0UyTUZBUUFXQ01WSVgyWEJITTJXV0dDS1YzWVBLWVBNU09WN05HVkVVQjQ3NVBNIn0sIm5hbWUiOiJjcmVhdGVBY2NvdW50In0seyJpZCI6MTUwNTU1Mjk0OTIyOCwibmFtZSI6InNldE9wdGlvbnMiLCJhdHRyaWJ1dGVzIjp7InNpZ25lciI6eyJ0eXBlIjoiZWQyNTUxOVB1YmxpY0tleSIsImNvbnRlbnQiOiJHQ0c1MkIyTEJZVlRQVUNJUUZEQjdWQlhBUks0T1VWNU5TRVE1UjZUMzQzRlc3R1I0TUJVTTNWNiIsIndlaWdodCI6IjEifSwic291cmNlQWNjb3VudCI6IkdEWFpaRzJJS0UyTUZBUUFXQ01WSVgyWEJITTJXV0dDS1YzWVBLWVBNU09WN05HVkVVQjQ3NVBNIn19LHsiaWQiOjE1MDU1NTM5NDI4MjEsIm5hbWUiOiJzZXRPcHRpb25zIiwiYXR0cmlidXRlcyI6eyJtYXN0ZXJXZWlnaHQiOiIwIiwibG93VGhyZXNob2xkIjoiMiIsIm1lZFRocmVzaG9sZCI6IjIiLCJoaWdoVGhyZXNob2xkIjoiMiIsInNpZ25lciI6eyJ0eXBlIjoic2hhMjU2SGFzaCIsImNvbnRlbnQiOiJjYTAyMGRmZGQxOGJmOTAxY2EyZTdlYjZiNzAxOTRkYTkzNjhiYTQ5NzFkN2JiODU0NWY0NmQ5YzRmN2U1NTBlIiwid2VpZ2h0IjoiMSJ9LCJzb3VyY2VBY2NvdW50IjoiR0RYWlpHMklLRTJNRkFRQVdDTVZJWDJYQkhNMldXR0NLVjNZUEtZUE1TT1Y3TkdWRVVCNDc1UE0ifX1dfQ%3D%3D&network=test):
    ```
      Operation: Create Account
                    Destination: hold acc
                    Balance: 40 (includes +10 for hash(x) signer and +10 for Bob signer)
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
      
    3. [Stellar] Bob creates and signs tx envelope for a refund tx for Alice and sends it to her [see in Laboratory](https://www.stellar.org/laboratory/#txbuilder?params=eyJhdHRyaWJ1dGVzIjp7InNvdXJjZUFjY291bnQiOiJHQTZWVjJDUklQVldBRkJKVlJYNjJZMkRNUTRDQlhXV1I3VE40T1dKUEVVWlZNU1VJUDM1U1lZTiIsInNlcXVlbmNlIjoiMTY4ODIwNDMyNjY3OTM0NzUiLCJtaW5UaW1lIjoiMTUwNTU3NDg3OCJ9LCJvcGVyYXRpb25zIjpbeyJpZCI6MCwiYXR0cmlidXRlcyI6eyJkZXN0aW5hdGlvbiI6IkdDVVZRM0FEVUJVVFg2NjI3VjI3SEVaSk9DR1BTQUZRS1FCWjVRQVBWVks3VFFVNUNFTUc1TjZLIiwiYXNzZXQiOnsidHlwZSI6Im5hdGl2ZSJ9LCJhbW91bnQiOiI0NDQifSwibmFtZSI6InBheW1lbnQifV19&network=test)):
    ```
    Source: holding account
      Time bound: 6h from now
      Operation: Account Merge
        Destination: Alice
      Signatures: Bob
    ```

    4. [Stellar] Alice submits Tx moving agreed XLM into the holding account:
    ```
      Source: Alice
      Operation: Payment to Holding Account
        Amount: agreed amount of XLM
    ```

    5. [Ethereum] Bob calls newContract() on Ethereum hashed timelock contract:
    ```
      receiver = Alices Ethereum address
      hashLock = hash(x)
      timelock = 6h from now
      msg.value = agreed ETH amount
    ```
3. Exchange
    1. [Ethereum] Alice calls withdraw() on the contract revealing x
       this sends the ETH to her account

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


## Scenario 2 (S2): Swap initiated by ETH holder on Ethereum

Summary:
* Bob initiates the setup process on Ethereum side
* Alice sells XLM to Bob
* Bob sells ETH to Alice

Protocol:

1. Agreement
  * same as in S1 1
2. Setup
    1. Bob generates secret x
    2. [Ethereum] Bob calls newContract() on Ethereum hashed timelock contract:
      * same as 2.5 in S1 - but Bob is aware of x here
    3. [Stellar] Alice submits Tx setting up Stellar holding account:
      * same as in 2.2 in S1 except that signers are Bob and Alice (instead Bob and hash(x))
    4. [Stellar] Bob creates and signs tx envelope and gives it to Alice (but doesn't submit to network):
      * same as in 2.3 in S1 - he signs the envelope
    5. [Stellar] Alice submits Tx moving agreed XLM into the holding account:
      * same as in 2.5 in S1
3. Exchange
    1. [Stellar] Bob submits TX to Stellar claiming his funds and revealing x:
    ```
    Source: Holding Account
    Operation: Account Merge
      Destination: Bob
    Signatures: bob, x
    ```
    2. [Ethereum] Alice calls withdraw() (now she knows x from Bobs Stellar tx)
       this sends the ETH to her account

NOTES:
1. If nothing happens after S2 2.4 Bob can get a refund after timelock time has passed by calling refund() on the Ethereum smart contract
2. If nothing happens after S2 2.5 Alice can get a refund after the timelock expires by signing the transaction Bob gave her in S1 2.4
