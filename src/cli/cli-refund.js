import Config from '../config'
import Protocol from '../protocol'
import Trade from '../trade'
import TradeDB from '../trade-db'
import {
  commander as program,
  configFileArgOrDefault,
  logError,
  fileToObj,
  verifyConfigFile,
} from './utils'

let tradeId, configJSON
program
  .description(
    'Refund if the trade was not completed and the timelock has expired.\n'
  )
  .optionConfig()
  .arguments('<tradeId>')
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

console.log(`Refund running ...`)

protocol.refund().then(result => {
  console.log(`result: ${result}`)
})
