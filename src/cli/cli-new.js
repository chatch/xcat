import program from 'commander'

import Config from '../config'
import Protocol from '../protocol'
import Trade from '../trade'

import {fileToObj, verifyArgTradeFile, verifyConfigFile} from './utils'

let configJSON, tradeJSON
program
  .description(
    'Initiate a new trade with a given trade.json file.\n' +
      '\n  The trade.json must conform to the schema in schema/trade.json.\n' +
      "\n  NOTE: file needs to be hand crafted but we'll provide a builder soon."
  )
  .option(
    '-c, --config <path>',
    'Config file (see config.json.template). Defaults to ./config.json.'
  )
  .arguments('<trade.json>')
  .action(function(jsonFile, options) {
    tradeJSON = jsonFile
    configJSON = options.config
  })

program.parse(process.argv)

if (!verifyConfigFile(configJSON)) program.help()
if (!verifyArgTradeFile(tradeJSON)) program.help()

const config = new Config(fileToObj(configJSON))
const trade = new Trade(fileToObj(tradeJSON))
const protocol = new Protocol(config, trade)
console.log(`stell: ${JSON.stringify(trade.stellar)}`)
console.log(`all: ${trade.toJSONAll()}`)
protocol.stellarPrepare().then(holdingAcc => {
  console.log(`StellarPrepare created account: ${holdingAcc}`)

  console.log(`Storing trade ... `)
  console.log(`Now waiting for the counterparty to issue EthereumPrepare ...`)
  console.log(
    `Press Ctrl-C to exit. You can can rejoin later by running "xcat status "`
  )
})
