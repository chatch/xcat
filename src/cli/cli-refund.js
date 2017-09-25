import program from 'commander'
import chalk from 'chalk'

import Config from '../config'
import {fileToObj, verifyConfigFile} from './utils'

let tradeId, configJSON
program
  .description(
    'Refund if the trade was not completed and the timelock has expired.\n'
  )
  .option(
    '-c, --config <path>',
    'Config file (see config.json.template). Defaults to ./config.json.'
  )
  .arguments('<tradeId>')
  .action(function(id, options) {
    tradeId = id
    configJSON = options.config
  })

program.parse(process.argv)

if (!verifyConfigFile(configJSON)) program.help()

const config = new Config(fileToObj(configJSON))
