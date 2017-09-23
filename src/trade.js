import Ajv from 'ajv'
import {
  isStellarPublicAddress,
  isStellarFederatedAddress,
  isEthereumPublicAddress,
  clone,
} from './utils'
const TradeSchema = require('./schema/trade.json')

const tradeValidator = () => {
  const ajv = new Ajv({allErrors: true})
  ajv.addFormat('stellarPublicAddress', isStellarPublicAddress)
  ajv.addFormat('stellarFederatedAddress', isStellarFederatedAddress)
  ajv.addFormat('ethereumPublicAddress', isEthereumPublicAddress)
  ajv.addSchema(TradeSchema, 'Trade')
  return {validator: ajv.compile(TradeSchema), ajv: ajv}
}
const {validator, ajv} = tradeValidator()

class Trade {
  /**
   * Create a new Trade validating the given JSON / object.
   *
   * @param trade JSON string or object
   * @return Trade instance
   * @throws Error with details if trade doesn't conform to schema
   */
  constructor(trade) {
    if (typeof trade === 'string') trade = JSON.parse(trade)
    const valid = validator(trade)
    if (!valid)
      throw new Error(
        `trade doesn't conform to schema trade.json [\n` +
          `\tmessage: "${ajv.errorsText(validator.errors)}"\n` +
          `\traw: ${JSON.stringify(validator.errors, null, 2)}` +
          `]`
      )
    Object.assign(this, trade)
  }

  setEthereumHtlcAddr(htlcAddr) {
    if (!isEthereumPublicAddress(htlcAddr))
      throw Error(`Contract address [${htlcAddr}] is not valid`)
    this.ethereum.htlcContractAddr = htlcAddr
  }

  setStellarHoldingAccount(acc) {
    if (!isStellarPublicAddress(acc))
      throw Error(`Stellar account address [${acc}] is not valid`)
    this.stellar.holdingAccount = acc
  }

  toJSONAgreement() {
    const agr = clone(this)
    delete agr.preimage
    delete agr.status
    return JSON.stringify(agr, null, 2)
  }

  toJSONAll() {
    return JSON.stringify(this, null, 2)
  }

  toStringPretty() {
    const t = this.trade
    return `Trade:
    Stellar
    -------
    Amount: ${t.stellar.amount}
    Holding Account: ${t.stellar.holdingAccount}
    `
  }
}

export default Trade
