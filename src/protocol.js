import sdk from 'stellar-sdk'
import Promise from 'bluebird'
import has from 'lodash/has'

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
  ERROR: 99,
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
   * Prepare the ethereum side of the trade by creating the hashed timelock
   *  contract.
   * @param onSuccess Callback called once the transaction has been mined (only 1 confirmation)
   * @param onError Callback called if there was a problem
   */
  async ethereumPrepare(onSuccess, onError) {
    const t = this.trade
    return this.eth.createHashedTimelockContract(
      t.commitment,
      t.ethereum.depositor,
      t.ethereum.withdrawer,
      t.ethereum.amount,
      t.timelock,
      onSuccess,
      onError
    )
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

  /**
   * Determine the Status of the trade by querying the chains.
   *
   * This functions as a verify up to the point of the returned status.
   *
   * @return Status reflecting the current state
   */
  async status() {
    let stellarPrepared = false
    let ethereumPrepared = false

    const ret = status => Promise.resolve(status)
    const retErr = () => Promise.reject(Status.ERROR)

    // Has Stellar side been prepared?
    const holdAcc = this.trade.stellar.holdingAccount
    if (holdAcc) {
      if (
        await this.stellar.isValidHoldingAccount(
          holdAcc,
          this.trade.stellar.withdrawer,
          this.trade.commitment
        )
      ) {
        stellarPrepared = true
      } else {
        console.error(`Have holdingAccount ${holdAcc} but it is NOT valid.`)
        return retErr()
      }
    }

    // Has Ethereum side been prepared?
    let contract
    const contractId = this.trade.ethereum.htlcContractId
    if (contractId) {
      contract = await this.ethereum.getContract(contractId)
      if (contract) {
        ethereumPrepared = true
      } else {
        console.error(
          `Have htlcContractId ${contractId} but it does NOT exist in ` +
            `the HTLC smart contract ${this.ethereum.htlc}.`
        )
        return retErr()
      }
    }

    if (!stellarPrepared && !ethereumPrepared) return ret(Status.INIT)
    if (stellarPrepared && !ethereumPrepared)
      return ret(Status.ETHEREUM_PREPARE)
    if (!stellarPrepared && ethereumPrepared) return ret(Status.STELLAR_PREPARE)

    // Both sides prepared so now check for fulfillments
    let stellarFulfilled = false
    let ethereumFulfilled = false

    if (contract.withdrawn) ethereumFulfilled = true

    const xlmBalance = Number(
      holdAcc.balances.filter(b => (b.asset_type = 'native'))[0].balance
    )
    if (xlmBalance === 0) {
      stellarFulfilled = true

      // TODO: further checks: look for the operation that moved the funds
      // to the receiver and check the exact amount was transferred
    }

    if (!stellarFulfilled && ethereumFulfilled)
      return ret(Status.STELLAR_FULFILL)
    if (stellarFulfilled && !ethereumFulfilled)
      return ret(Status.ETHEREUM_FULFILL)

    return ret(Status.FINALISED)
  }
}
Protocol.Status = Status

export default Protocol
