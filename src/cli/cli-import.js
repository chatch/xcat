import Config from '../config'
import Protocol from '../protocol'
import Trade from '../trade'
import {
  commander as program,
  configFileArgOrDefault,
  fileToObj,
  verifyConfigFile,
  verifyArgTradeFile,
} from './utils'

let configJSON, tradeJSON
program
  .description(
    `Import a trade with a given trade.json file. Typically this file is ` +
      `sent from a counterparty who initiated a trade with "trade new". ` +
      `As with "trade new" this trade.json must conform to the schema in ` +
      `schema/trade.json.`
  )
  .optionConfig()
  .arguments('<tradeJSON>')
  .action(function(jsonFile, options) {
    tradeJSON = jsonFile
    configJSON = options.config
  })
  .parse(process.argv)

configJSON = configFileArgOrDefault(configJSON)

if (!verifyConfigFile(configJSON)) program.help()
if (!verifyArgTradeFile(tradeJSON)) program.help()

const config = new Config(fileToObj(configJSON))
const trade = new Trade(fileToObj(tradeJSON))

// protocol will add the trade to the local db here if it hasn't already been imported
const protocol = new Protocol(config, trade)

console.log(`Check status running ...`)
protocol.status().then(status => {
  console.log(`status: ${status}`)

  // prompt for next action or show waiting for counterparty action
})
