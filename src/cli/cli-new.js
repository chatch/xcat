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

if (!verifyArgTradeFile(tradeJSON)) program.help()
if (!verifyConfigFile(configJSON)) program.help()

const trade = new Trade(fileToObj(tradeJSON))
const config = new Config(fileToObj(configJSON))
const protocol = new Protocol(config, trade)
protocol.stellarPrepare().then(receipt => {
  console.log(`StellarPrepare receipt: ${JSON.stringify(receipt)}`)
  console.log(trade.toStringPretty())
})
