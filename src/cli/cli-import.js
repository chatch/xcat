import inquirer from 'inquirer'

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

const processArgs = () => {
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
    .action((jsonFile, options) => {
      tradeJSON = jsonFile
      configJSON = options.config
    })
    .parse(process.argv)

  return {configJSON, tradeJSON}
}

const parseFiles = (configJSON, tradeJSON) => {
  configJSON = configFileArgOrDefault(configJSON)

  if (!verifyConfigFile(configJSON)) program.help()
  if (!verifyArgTradeFile(tradeJSON)) program.help()

  const config = new Config(fileToObj(configJSON))
  const trade = new Trade(fileToObj(tradeJSON))

  return {config, trade}
}

const promptAcceptTrade = () =>
  inquirer
    .prompt([
      {
        type: 'confirm',
        name: 'accept',
        message: 'Would you like to accept this trade?',
      },
    ])
    .then(r => r.accept)

const promptPrepareEthereum = () =>
  inquirer
    .prompt([
      {
        type: 'confirm',
        name: 'accept',
        message:
          'The next step is to setup the Ethereum hashed timelock contract. Would you like to proceed?',
      },
    ])
    .then(r => r.accept)

const main = async () => {
  const {configJSON, tradeJSON} = processArgs()
  const {config, trade} = parseFiles(configJSON, tradeJSON)

  // protocol will add the trade to the local db here if it hasn't already been imported
  const protocol = new Protocol(config, trade)

  // print trade details and ask for confirmation to proceed
  console.log(trade.toStringPretty())

  const acceptTrade = await promptAcceptTrade()
  if (!acceptTrade) return

  console.log(`Checking the status ...`)
  const status = await protocol.status()
  console.log(`status: ${Protocol.Status.key(status)}`)

  // next step is Ethereum prepare
  if (status === Protocol.Status.ETHEREUM_PREPARE) {
    // if for this local user
    if (
      protocol.trade.ethereum.depositor ===
      protocol.config.ethereumPublicAddress
    ) {
      const acceptPrepare = await promptPrepareEthereum()
      if (!acceptPrepare) return

      console.log(`ethereumPrepare call`)
      protocol
        .ethereumPrepare()
        .then(contractId =>
          console.log(`Ethereum side prepared (htlc address: ${contractId})`)
        )
        .catch(err => console.error(`ethereumPrepare error: ${err}`))
    } else {
      console.log(`Wait for the counterparty to prepare the Ethereum side`)
    }
  } else if (status === Protocol.Status.STELLAR_PREPARE) {
    // TODO: handle this once initiating from the Ethereum side is done
  }
}

main().catch(error => console.error(`Import failed: ${error}`))
