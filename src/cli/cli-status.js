import inquirer from 'inquirer'
import sdk from 'stellar-sdk'

import Config from '../config'
import Protocol from '../protocol'
import Trade from '../trade'
import TradeDB from '../trade-db'
import {bufToStr, isSha256Hash, sha256, strToBuf} from '../utils'
import {
  commander as program,
  configFileArgOrDefault,
  fileToObj,
  logError,
  verifyConfigFile,
} from './utils'

const processArgs = () => {
  let tradeId, configOpt
  program
    .description(`Check status of a trade given the trade id.`)
    .arguments('<tradeId>')
    .optionConfig()
    .action((id, options) => {
      tradeId = id
      configOpt = options.config
    })
    .parse(process.argv)
  return {tradeId, configOpt}
}

const validatePreimageInput = (preimage, commitment) => {
  if (!isSha256Hash(preimage.trim()))
    return 'Preimage must be a sha256 hash. Please enter the original preimage.'
  else {
    const preimageStr = preimage.replace('0x', '')
    console.log(`preimage : ${preimageStr}`)
    const hashXStr = bufToStr(sha256(strToBuf(preimage)))
    if (hashXStr !== commitment)
      return `sha256(${preimageStr}) [${hashXStr}] does not equal the contract commitment [${commitment}]`
  }
  return true
}

const promptPreimage = commitment =>
  inquirer
    .prompt([
      {
        type: 'input',
        name: 'preimage',
        message:
          'Enter the preimage of the trade commitment to claim your funds: ',
        validate: preimage => validatePreimageInput(preimage, commitment),
      },
    ])
    .then(r => r.preimage)

const main = async () => {
  const {tradeId, configOpt} = processArgs()

  const tradeDB = new TradeDB()
  const tradeObj = tradeDB.get(tradeId)
  if (!tradeObj) {
    logError(`Trade ${tradeId} unknown. Has it been imported?`)
    program.help()
  }

  const configJSON = configFileArgOrDefault(configOpt)
  if (!verifyConfigFile(configJSON)) program.help()

  const config = new Config(fileToObj(configJSON))
  const trade = new Trade(tradeObj)
  const protocol = new Protocol(config, trade)

  console.log(`Check status running ...`)
  const status = await protocol.status()
  console.log(`status: ${Protocol.Status.key(status)}`)

  if (status === Protocol.Status.ETHEREUM_FULFILL) {
    if (
      protocol.trade.ethereum.withdrawer ===
      protocol.config.ethereumPublicAddress
    ) {
      const contract = await protocol.getContract()
      console.log(`HTLC Contract: ${JSON.stringify(contract, null, 2)}`)
      const preimage = await promptPreimage(contract.hashlock)
      console.log(`Calling EthereumFulfill`)
      const txHash = await protocol.ethereumFulfill(preimage)
      console.log(`finished with txhash: ${txHash}`)
    } else {
      console.log(`Wait it out for the other guy .... `)
    }
  } else if (status === Protocol.Status.STELLAR_FULFILL) {
    const localAccPubKey = sdk.Keypair
      .fromSecret(protocol.config.stellarAccountSecret)
      .publicKey()
    if (protocol.trade.stellar.withdrawer === localAccPubKey) {
      // Get preimage from either the Etheruem HashedTimelock contract if the
      // ETH side already fulfilled, otherwise prompt the local user to input it.
      let preimage
      if (protocol.isEthereumFulfilled()) {
        const htlcContract = await protocol.getContract()
        preimage = htlcContract.preimage
      } else {
        preimage = await promptPreimage(protocol.config.commitment)
      }

      console.log(`Calling StellarFulfill with preimage: ${preimage}`)
      return protocol.stellarFulfill(preimage)
    } else {
      console.log(`Wait it out for the other guy .... `)
    }
  }
}

main()
  .then(() => console.log(`finished`))
  .catch(logError)
