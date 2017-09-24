import program from 'commander'
import chalk from 'chalk'

import Config from '../config'
import Protocol from '../protocol'
import Trade from '../trade'

import {verifyArgTradeFile, verifyConfigFile} from './utils'
import {fileToObj, objToFile} from '../utils'

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

console.log(`StellarPrepare running ...\n`)
protocol.stellarPrepare().then(trade => {
  const tradeFile = `trade-${trade.id}.json`
  objToFile(tradeFile, trade)

  console.log(
    `Trade created with ID: ${chalk.bgGreen.white.bold(`${trade.id}`)}\n`
  )

  console.log(
    `Send the file ${chalk.bgBlue.white.bold(
      `./${tradeFile}`
    )} to the counterparty so they can accept the trade with:\n\n${chalk.bold(
      ` xcat import ${tradeFile}`
    )}\n`
  )

  console.log(
    `You can check the status and wait for the counterparty to accept with:\n\n` +
      `${chalk.bold(` xcat status ${trade.id}`)}\n`
  )
})
