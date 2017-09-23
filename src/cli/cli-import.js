import program from 'commander'

import Config from '../config'
import Protocol from '../protocol'
import Trade from '../trade'

import {fileToObj, verifyArgTradeFile, verifyConfigFile} from './utils'

let configJSON, tradeJSON
program
  .description(
    `Import a trade with a given trade.json file. Typically this file is ` +
      `sent from a counterparty who initiated a trade with "trade new". ` +
      `As with "trade new" this trade.json must conform to the schema in ` +
      `schema/trade.json.`
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

console.log(trade.toJSONAll())
