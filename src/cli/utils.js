import chalk from 'chalk'
import {existsSync} from 'fs'

import Trade from '../trade'
import Config from '../config'
import {fileToObj} from '../utils'

const logError = msg => console.error(chalk.red(`\nERROR: ${msg}`))

const verifyArgTradeFile = filename => {
  if (!filename || (typeof filename === 'string' && filename.trim() === '')) {
    logError(`No file provided. Pass the name of a trade.json file.`)
    return false
  }

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

const verifyConfigFile = filename => {
  // look for config.json in local directory if not provided
  if (!filename || typeof filename !== 'string' || filename.trim() === '')
    filename = './config.json'

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

const verifyArgTradeID = id => {
  throw new Error(
    `not yet implemented - will pull a trade record for ${id} from a local database`
  )
}

export {
  fileToObj,
  logError,
  verifyArgTradeFile,
  verifyArgTradeID,
  verifyConfigFile,
}
