import program from 'commander'
import chalk from 'chalk'

import Config from '../config'
import Protocol from '../protocol'
import Trade from '../trade'

import {
  verifyArgTradeFile,
  verifyConfigFile,
  verifyNewTradeTimelock,
} from './utils'
import {fileToObj, objToFile, objToStr, sign, strToFile} from '../utils'

const secsToDateStr = secs => new Date(secs * 1000).toString()

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

// TODO: new trade checks and logic belong in protocol .. move to there.
if (!verifyNewTradeTimelock(trade.timelock)) program.help()

console.log(`StellarPrepare running ...`)
protocol.stellarPrepare().then(trade => {
  const tradeFile = `trade-${trade.id}.json`
  objToFile(tradeFile, trade)

  const signature = sign(config.stellarAccountSecret, objToStr(trade))
  const sigFile = `${tradeFile}.sig`
  strToFile(sigFile, signature)

  console.log(`
Trade created:

+==============================================================+
=
=  Id:         ${chalk.bgGreen.white.bold(trade.id)}
=  Trade file: ${chalk.bgBlue.white.bold(`./${tradeFile}`)}
=  Signature:  ${chalk.bgBlue.white.bold(`./${sigFile}`)}
=
+==============================================================+

Send files above to the counterparty. They can verify and accept the trade by:

  ${chalk.bold(`xcat verify ${tradeFile} ${sigFile}`)} (optional)
  ${chalk.bold(`xcat import ${tradeFile}`)}

To check the status and wait for the counterparty to accept run:

  ${chalk.bold(`xcat status ${trade.id}`)}

If the counterparty does not accept, claim your refund after ${chalk.bgMagenta.white.bold(
    secsToDateStr(trade.timelock)
  )} by running:

  ${chalk.bold(`xcat refund ${trade.id}`)}
`)
})
