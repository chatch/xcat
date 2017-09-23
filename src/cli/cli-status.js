import program from 'commander'

import Protocol from '../protocol'
import TradeDB from '../trade-db'

import {verifyArgTradeID} from './utils'

let tradeID
program
  .description(`Check status of a trade given the trade id.`)
  .arguments('<trade id>')
  .action(function(id) {
    tradeID = id
  })

program.parse(process.argv)

if (!verifyArgTradeID(tradeID)) program.help()

const trade = TradeDB.get(tradeID)
const protocol = new Protocol(null, trade)

console.log(trade.toJSONAll())
