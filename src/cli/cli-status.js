import Config from '../config'
import Protocol from '../protocol'
import Trade from '../trade'
import TradeDB from '../trade-db'
import {
  commander as program,
  configFileArgOrDefault,
  fileToObj,
  logError,
  verifyConfigFile,
} from './utils'

let tradeId, configJSON
program
  .description(`Check status of a trade given the trade id.`)
  .arguments('<trade id>')
  .optionConfig()
  .action(function(id, options) {
    tradeId = id
    configJSON = options.config
  })
  .parse(process.argv)

const tradeDB = new TradeDB()
const tradeObj = tradeDB.get(tradeId)
if (!tradeObj) {
  logError(`Trade ${tradeId} unknown. Has it been imported?`)
  program.help()
}

configJSON = configFileArgOrDefault(configJSON)
if (!verifyConfigFile(configJSON)) program.help()

const config = new Config(fileToObj(configJSON))
const trade = new Trade(tradeObj)
const protocol = new Protocol(config, trade)

console.log(`Check status running ...`)
protocol.status().then(status => {
  console.log(`status: ${status}`)

  // prompt for next action or show waiting for counterparty action
})
