import sdk from 'stellar-sdk'
import Promise from 'bluebird'

import Stellar from './stellar'
import Ethereum from './ethereum'
import HTLC from './contracts/HashedTimelock.json'
import TradeDB from './trade-db'
import {isClassWithName} from './utils'

const Status = Object.freeze({
  INIT: 0,
  STELLAR_PREPARE: 1,
  ETHEREUM_PREPARE: 2,
  STELLAR_FULFILL: 3,
  ETHEREUM_FULFILL: 4,
  FINALISED: 5,
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
    this.eth = new Ethereum(config.ethereumRPC, config.ethereumNetwork, HTLC)
  }

  /**
   * Prepare the stellar side of the trade by creating the holding account.
   * @return updated trade instance that now has 'stellar.holdingAccount' and
   *            if newly created an 'id' as well.
   */
  async stellarPrepare() {
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
        this.trade = this.tradeDB.save(this.trade)
        return this.trade
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
  subscribe() {}

  /**
   * Determine the Status of the trade by querying the chains.
   * @return Status reflecting the current state
   */
  async status() {
    // determine and update the status
    this.status()

    // get all events
    const getPastEvents = Promise.promisify(this.eth.htlc.getPastEvents)
    this.htlcEvents = await getPastEvents('allEvents')
    this.eth.htlc.events.allEvents(this.ethereumEventHandlerHTLC)
    // subscribe to events

    this.localParty = 'stellar'
    this.status = Status.ETHEREUM_PREPARE
  }
}
Protocol.Status = Status

export default Protocol
