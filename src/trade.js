import Ajv from 'ajv'
import chalk from 'chalk'
import {
  clone,
  isEthereumPublicAddress,
  isSha256Hash,
  isStellarFederatedAddress,
  isStellarPublicAddress,
  objToStr,
  secsToDateStr,
} from './utils'
const TradeSchema = require('./schema/trade.json')

const {validator, ajv} = (() => {
  const ajv = new Ajv({allErrors: true})
  ajv.addFormat('stellarPublicAddress', isStellarPublicAddress)
  ajv.addFormat('stellarFederatedAddress', isStellarFederatedAddress)
  ajv.addFormat('ethereumPublicAddress', isEthereumPublicAddress)
  ajv.addFormat('sha256Hash', isSha256Hash)
  ajv.addSchema(TradeSchema, 'Trade')
  return {validator: ajv.compile(TradeSchema), ajv: ajv}
})()

class Trade {
  static validate(trade) {
    return validator(trade)
  }

  /**
   * Create a new Trade validating the given JSON / object.
   *
   * @param trade JSON string or object
   * @return Trade instance
   * @throws Error with details if trade doesn't conform to schema
   */
  constructor(trade) {
    if (typeof trade === 'string') trade = JSON.parse(trade)
    const valid = Trade.validate(trade)
    if (!valid)
      throw new Error(
        `trade doesn't conform to schema trade.json [\n` +
          `\tmessage: "${ajv.errorsText(validator.errors)}"\n` +
          `\traw: ${objToStr(validator.errors)}` +
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
    return objToStr(agr)
  }

  toJSONAll() {
    return objToStr(this)
  }

  toStringPretty() {
    const s = this.stellar
    const e = this.ethereum
    return chalk.cyan(`
Trade Summary
=============
${s.amount} XLM for ${e.amount} ETH

Stellar
-------
From:    ${s.depositor}
To:      ${s.withdrawer}
Escrow:  ${s.holdingAccount ? s.holdingAccount : '<none yet>'}

Ethereum
--------
From:    ${e.depositor}
To:      ${e.withdrawer}
Escrow:  ${e.htlcContractId ? e.htlcContractId : '<none yet>'}

Commitment:  ${this.commitment}
Expires:     ${secsToDateStr(this.timelock)}
`)
  }
}

export default Trade
