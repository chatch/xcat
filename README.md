# xcat
A tool for doing cross chain atomic trades via a [cli](src/cli) or [api](src/protocol.js).

## Protocol
Stellar XLM <-> Ethereum ETH
 * [protocol_stellar_xlm_to_ethereum_eth.md](docs/protocol_stellar_xlm_to_ethereum_eth.md)
 * [protocol-scenario1.js](integration-test/protocol-scenario1.js) - script that walks through scenario 1 of the protocol
 
Stellar Asset <-> Ethereum ERC20 Token
 * [protocol_stellar_asset_to_ethereum_erc20.md](docs/protocol_stellar_asset_to_ethereum_erc20.md) TODO

## Trade.json

Trades are defined by a trade.json file conforming to the JSON schema [here](src/schema/trade.json).

Example:
```
{
  "timelock": 1505729032,
  "commitment":
    "22bf0b3d38d2bec7226eeafd6571cdd452d34a79fb4e72f98e246d372c6a9855",
  "stellar": {
    "token": "XLM",
    "amount": 2000.0,
    "depositor": "GADU5GS223ZOY7LRWDE5IQBGMCNI523FCF5CFP2KPMMU3TKLJ7IPHEJU",
    "withdrawer": "GD3BNTEXZF7IG4OSWDJMCZ4V6N4I6XGEWO5Y6P3FYAZ24ARF2DWV2P3L"
  },
  "ethereum": {
    "token": "ETH",
    "amount": 1.0,
    "depositor": "0x7ee7d41559284957f1cd6bd14a658bf985d87ad0",
    "withdrawer": "0xfc80237acff828e5a69ba27ec506c2296dab2f68"
  }
}
```
 
## CLI
 
babel-node src/cli/cli
 
```
  Usage: cli [options] [command]

  Stellar tool for doing cross chain atomic trades


  Options:

    -h, --help  output usage information


  Commands:

    new|n <trade.json>                         Initiate a new trade given a trade.json file
    import|i <trade.json>                      Import a trade from a trade.json file
    status|s <tradeId>                         Check status of a trade
    verifysig|v <trade.json> <trade.json.sig>  Verify signature for a trade.json
    help [cmd]                                 display help for [cmd]
```
