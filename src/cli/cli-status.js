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

const {log} = console

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
    log(`preimage : ${preimageStr}`)
    const hashXStr = bufToStr(sha256(strToBuf(preimage)))
    if (hashXStr !== commitment)
      return `sha256(${preimageStr}) [${
        hashXStr
      }] does not equal the contract commitment [${commitment}]`
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

  log(`Check status running ...`)
  const status = await protocol.status()
  log(`\nstatus: ${Protocol.Status.key(status)}`)

  // Stellar holding account created AND this user is the Stellar taker:
  //  generate the refund tx for the counterparty (Stellar seller)
  if (
    status === Protocol.Status.STELLAR_HOLDING_ACCOUNT &&
    protocol.isEthereumDepositor()
  ) {
    await protocol.stellarRefundTx()
    log(
      `\nGenerating refund transaction envelope for the counterparty: ` +
        `\n\n[${protocol.trade.stellar.refundTx}]\n\n` +
        `Send this to the counterparty so they can continue the trade.` +
        `\n\nNOTE:\n  1) In case the trade does not complete this allows the ` +
        `counterparty to get thier escrow funds back.` +
        `\n  2) In case the trade completes this transaction will be useless.`
    )
  } else if (
    status === Protocol.Status.STELLAR_REFUND_TX &&
    protocol.isStellarDepositor()
  ) {
    log(
      `\nDepositing ${
        protocol.trade.stellar.amount
      } XLM into holding account ...`
    )
    await protocol.stellarDeposit()
    log(`\nWait for counterparty to setup Ethereum HTLC ...`)
  } else if (
    status === Protocol.Status.STELLAR_DEPOSIT &&
    protocol.isEthereumDepositor()
  ) {
    log(`\nCreating hash timelock contract on Ethereum ...`)
    const htlcId = await protocol.ethereumPrepare()
    log(`\nhtlc created: ${htlcId}`)
    log(
      `\nnow wait for the counterparty to withdraw the funds and reveal the preimage ...`
    )
  } else if (
    status === Protocol.Status.ETHEREUM_HTLC &&
    protocol.isStellarDepositor()
  ) {
    const contract = await protocol.getContract()
    log(`HTLC Contract: ${JSON.stringify(contract, null, 2)}`)
    const preimage = await promptPreimage(contract.hashlock)
    log(`Calling EthereumFulfill`)
    const txHash = await protocol.ethereumFulfill(preimage)
    log(`finished with txhash: ${txHash}`)
  } else if (
    status === Protocol.Status.ETHEREUM_WITHDRAW &&
    protocol.isStellarWithdrawer()
  ) {
    // Get preimage from the Etheruem HashedTimelock contract
    const htlcContract = await protocol.getContract()
    const preimage = htlcContract.preimage
    log(`Calling StellarFulfill with preimage: ${preimage}`)
    return protocol.stellarFulfill(preimage)
  }
}

main()
  .then(() => log(`\nDONE\n`))
  .catch(logError)
