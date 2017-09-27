import {Command} from 'commander'
import chalk from 'chalk'
import {existsSync} from 'fs'

import Trade from '../trade'
import Config from '../config'
import {fileToObj} from '../utils'

const MIN_TIMELOCK_EXPIRY = 3600 // 1 hour

const logError = msg => console.error(chalk.red(`\nERROR: ${msg}`))

// given filename arg, use it if non blank, else use defaultFile
const fileArgOrDefault = (filename, defaultFile) =>
  !filename || typeof filename !== 'string' || filename.trim() === ''
    ? defaultFile
    : filename

const configFileArgOrDefault = filename =>
  fileArgOrDefault(filename, './config.json')

const verifyConfigFile = filename => {
  if (!existsSync(filename)) {
    logError(
      `Config file [${filename}] does not exist. Put a config.json in the ` +
        `local path OR provide one with --config.`
    )
    return false
  }

  try {
    new Config(fileToObj(filename))
  } catch (err) {
    logError(`Failed to parse [${filename}]:`)
    console.error(`\n\n${err}`)
    return false
  }

  return true
}

const verifyArgTradeFile = filename => {
  if (!existsSync(filename)) {
    logError(`Trade file [${filename}] does not exist.`)
    return false
  }

  try {
    new Trade(fileToObj(filename))
  } catch (err) {
    logError(`Failed to parse [${filename}]:`)
    console.error(`\n\n${err}`)
    return false
  }

  return true
}

const verifyArgTradeID = id => {
  throw new Error(
    `not yet implemented - will pull a trade record for ${id} from a local database`
  )
}

const verifyNewTradeTimelock = timelock => {
  if (timelock < Math.floor(Date.now() / 1000) + MIN_TIMELOCK_EXPIRY) {
    logError(
      `Timelock expiry must be at least ${MIN_TIMELOCK_EXPIRY} ` +
        `seconds in the future`
    )
    return false
  }
  return true
}

Command.prototype.optionConfig = function() {
  return this.option(
    '-c, --config <path>',
    'Config file (see config.json.template). Defaults to ./config.json.'
  )
}
const commander = new Command()

export {
  commander,
  configFileArgOrDefault,
  fileArgOrDefault,
  fileToObj,
  logError,
  verifyArgTradeFile,
  verifyArgTradeID,
  verifyConfigFile,
  verifyNewTradeTimelock,
}
