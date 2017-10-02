import sdk from 'stellar-sdk'
import Promise from 'bluebird'
import has from 'lodash/has'

import Stellar from './stellar'
import Ethereum from './ethereum'
import HTLC from './contracts/HashedTimelock'
import htlcDeployment from './contracts/deployment'
import TradeDB from './trade-db'
import {isClassWithName} from './utils'

const Status = Object.freeze({
  INIT: 0,
  STELLAR_PREPARE: 1,
  ETHEREUM_PREPARE: 2,
  STELLAR_FULFILL: 3,
  ETHEREUM_FULFILL: 4,
  FINALISED: 5,
  ERROR: 99,
  key: value => Object.keys(Status).filter(k => Status[k] === value)[0],
})

const TradeSide = Object.freeze({
  STELLAR: 'stellar',
  ETHEREUM: 'ethereum',
})

class Protocol {
  /**
   * Create a new protocol instance given local user Config and a Trade.
   *
   * After the instance is created status() should be called to determine the
   * state of the trade and the position in the protocol.
   *
   * @param trade Trade instance
   * @param config Config instance
   */
  constructor(config, trade) {
    if (!isClassWithName(config, 'Config'))
      throw new Error('instance of Config required')
    if (!isClassWithName(trade, 'Trade'))
      throw new Error('instance of Trade required')

    this.config = config
    this.trade = trade
    this.tradeDB = new TradeDB()
    this.stellar = new Stellar(sdk, config.stellarNetwork)
    this.eth = new Ethereum(
      config.ethereumRPC,
      HTLC,
      htlcDeployment[config.ethereumNetwork]
    )

    // trade has an id but it's not in the database (most likely from an import)
    if (has(trade, 'id') && this.tradeDB.get(trade.id) === undefined) {
      this.tradeDB.save(trade)
    }
  }

  /**
   * Prepare the stellar side of the trade by creating the holding account.
   * @return updated trade instance that now has 'stellar.holdingAccount' and
   *            if newly created an 'id' as well.
   */
  stellarPrepare() {
    const newAccKeypair = sdk.Keypair.random()
    const sellerKeypair = sdk.Keypair.fromSecret(
      this.config.stellarAccountSecret
    )
    return this.stellar
      .createHoldingAccount(
        newAccKeypair,
        sellerKeypair,
        this.trade.stellar.withdrawer,
        this.trade.commitment
      )
      .then(() => {
        this.trade.stellar.holdingAccount = newAccKeypair.publicKey()
        if (
          !has(this.trade, 'initialSide') &&
          !has(this.trade.ethereum, 'htlcContractId')
        )
          this.trade.initialSide = TradeSide.STELLAR
        this.trade = this.tradeDB.save(this.trade)
        return this.trade
      })
  }

  /**
   * Prepare the ethereum side of the trade by creating the hashed timelock
   *  contract.
   * @return New contract id
   */
  ethereumPrepare() {
    const t = this.trade
    return this.eth
      .createHashedTimelockContract(
        t.commitment,
        t.ethereum.depositor,
        t.ethereum.withdrawer,
        t.ethereum.amount,
        t.timelock
      )
      .then(newContractId => {
        t.ethereum.htlcContractId = newContractId
        if (
          !has(this.trade, 'initialSide') &&
          !has(this.trade.stellar, 'holdingAccount')
        )
          this.trade.initialSide = TradeSide.ETHEREUM
        this.tradeDB.save(t)
        return newContractId
      })
  }

  /**
   * This function gets notified of ALL events from the Ethereum HTLC contract.
   */
  ethereumEventHandlerHTLC() {}

  /**
   * Trade protocol status is at a place where we are waiting for the
  * counterparty to take the next step.
   * @return bool
   */
  waitingForCounterparty() {}

  /**
   * Trade protocol status is at a place where we are waiting on the local party
   * to take the next step.
   * @return bool
   */
  waitingForMe() {}

  /**
   * Progress to the next state if possible.
   */
  next() {
    switch (this.status) {
      case Status.ETHEREUM_PREPARE:
        break
      case Status.FINALISED:
        break
      default:
        console.error(`unknown status [${this.status}]`)
        break
    }
  }

  /**
   * Subscribe to counterparty events. Required when this local party is waiting
   * for the next step to be completed by the counterparty.
   */
  subscribe() {
    // // get all events
    // const getPastEvents = Promise.promisify(this.eth.htlc.getPastEvents)
    // this.htlcEvents = await getPastEvents('allEvents')
    // this.eth.htlc.events.allEvents(this.ethereumEventHandlerHTLC)
    // // subscribe to events
    //
    // this.localParty = 'stellar'
    // this.status = Status.ETHEREUM_PREPARE
  }

  async isEthereumPrepared() {
    let prepared = false

    if (!this.trade.ethereum.htlcContractId) {
      // no contract in trade record but look for one on the blockchain
      const contractId = await this.eth.findContract(
        this.trade.ethereum.depositor,
        this.trade.ethereum.withdrawer,
        this.trade.ethereum.amount,
        this.trade.commitment,
        this.trade.locktime
      )
      if (contractId) this.trade.ethereum.htlcContractId = contractId
      this.tradeDB.save(this.trade)
    }

    let contract
    if (this.trade.ethereum.htlcContractId) {
      contract = await this.eth.getContract(this.trade.ethereum.htlcContractId)
      if (contract) {
        prepared = true
      } else {
        throw new Error(
          `Have htlcContractId ${this.trade.ethereum.htlcContractId} but it ` +
            `does NOT exist in the HTLC smart contract ` +
            `${this.eth.htlc.address}.`
        )
      }
    }

    return prepared
  }

  isStellarPrepared() {
    if (!this.trade.stellar.holdingAccount) return Promise.resolve(false)
    return this.stellar
      .isValidHoldingAccount(
        this.trade.stellar.holdingAccount,
        this.trade.stellar.withdrawer,
        this.trade.commitment
      )
      .then(isValid => {
        if (!isValid)
          throw new Error(
            `Have holdingAccount ` +
              `${this.trade.stellar.holdingAccount} but it is NOT valid.`
          )
        return isValid
      })
  }

  isEthereumFulfilled() {
    return this.eth
      .getContract(this.trade.ethereum.htlcContractId)
      .then(contract => contract.withdrawn === true)
  }

  isStellarFulfilled() {
    return this.stellar
      .loadAccount(this.trade.stellar.holdingAccount)
      .then(holdAccRec => {
        const xlmBalance = Number(
          holdAccRec.balances.filter(b => (b.asset_type = 'native'))[0].balance
        )
        return xlmBalance === 0
        // TODO: further checks: look for the operation that moved the funds
        // to the receiver and check the exact amount was transferred
      })
  }

  /**
   * Determine the Status of the trade by querying the chains.
   *
   * This functions as a verify up to the point of the returned status.
   *
   * @return Status reflecting the current state
   * @throw Error trade record has bad addresses or doesn't reflect ledger state
   *          eg. holding account defined in trade does not exist on chain
   */
  async status() {
    const ethereumPrepared = await this.isEthereumPrepared()
    const stellarPrepared = await this.isStellarPrepared()

    if (!stellarPrepared && !ethereumPrepared) return Status.INIT
    else if (stellarPrepared && !ethereumPrepared)
      return Status.ETHEREUM_PREPARE
    else if (!stellarPrepared && ethereumPrepared) return Status.STELLAR_PREPARE

    // Both sides prepared so now check for fulfillments
    const stellarFulfilled = await this.isStellarFulfilled()
    const ethereumFulfilled = await this.isEthereumFulfilled()

    let status

    if (stellarFulfilled === false && ethereumFulfilled === false)
      status =
        this.trade.initialSide === TradeSide.STELLAR
          ? Status.STELLAR_FULFILL
          : Status.ETHEREUM_FULFILL
    else if (stellarFulfilled === false && ethereumFulfilled === true)
      status = Status.STELLAR_FULFILL
    else if (stellarFulfilled === true && ethereumFulfilled === false)
      status = Status.ETHEREUM_FULFILL
    else status = Status.FINALISED

    return status
  }
}
Protocol.Status = Status

export default Protocol
