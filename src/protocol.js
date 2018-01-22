import sdk from 'stellar-sdk'
import Promise from 'bluebird'
import has from 'lodash/has'
import HTLC from 'ethereum-htlc/abi/HashedTimelock'
import {htlc as htlcDeployment} from 'ethereum-htlc/deployment'

import Stellar from './stellar'
import Ethereum from './ethereum'
import TradeDB from './trade-db'
import {isClassWithName} from './utils'

const Status = Object.freeze({
  INIT: 0,
  STELLAR_HOLDING_ACCOUNT: 1,
  STELLAR_REFUND_TX: 2,
  STELLAR_DEPOSIT: 3,
  ETHEREUM_HTLC: 4,
  ETHEREUM_WITHDRAW: 5,
  STELLAR_WITHDRAW: 6,
  EXPIRED: 7,
  FINALISED: 8,
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
   * @param config Config instance
   * @param trade Trade instance
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
    return this.stellar
      .createHoldingAccount(
        newAccKeypair,
        this.stellarKeypair(),
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

  async stellarDeposit() {
    if (!this.isStellarDepositor())
      throw new Error(
        'Only the trade Stellar depositor can call stellarDeposit()'
      )
    const sellerKeypair = this.stellarKeypair()

    const holdingAccountPublicAddr = this.trade.stellar.holdingAccount
    const holdingAccountBalance = await this.stellar.getBalance(
      holdingAccountPublicAddr
    )

    // deposit the difference - transfer to counterparty will be an account merge so the total will transfer
    const amount = this.trade.stellar.amount - holdingAccountBalance
    return this.stellar.sellerDeposit(
      sellerKeypair,
      holdingAccountPublicAddr,
      amount
    )
  }

  /**
   * Prepare the Ethereum HTLC and deposit the funds in it at the same time
   * @return id of new HTLC contract
   */
  async ethereumPrepare() {
    const t = this.trade

    // Create the Ethereum HTLC
    t.ethereum.htlcContractId = await this.eth.createHashedTimelockContract(
      t.commitment,
      t.ethereum.depositor,
      t.ethereum.withdrawer,
      t.ethereum.amount,
      t.timelock
    )

    // set initialSide in trade if not yet set
    if (!has(t, 'initialSide') && !has(t.stellar, 'holdingAccount'))
      this.trade.initialSide = TradeSide.ETHEREUM
    this.tradeDB.save(t)

    return t.ethereum.htlcContractId
  }

  async stellarRefundTx() {
    // TODO: check the status

    this.trade.stellar.refundTx = await this.stellar.sellerRefundTxEnvelope(
      this.trade.stellar.holdingAccount,
      this.stellarKeypair(),
      this.trade.stellar.depositor,
      this.trade.timelock,
      this.trade.stellar.amount
    )
    this.tradeDB.save(this.trade)

    return this.trade.stellar.refundTx
  }

  /**
   * Fulfill the Ethereum side by having the withdrawer reveal hash(x) and get
   * their ETH.
   * @return txHash of the fulfill transaction
   */
  ethereumFulfill(preimage) {
    return this.eth
      .buyerWithdraw(
        this.trade.ethereum.htlcContractId,
        preimage,
        this.trade.ethereum.withdrawer
      )
      .then(txReceipt => txReceipt.tx)
  }

  /**
   * Fulfill the Stellar side by having the withdrawer reveal hash(x) and get
   * their XLM.
   * @return Promise resolving to txHash of the fulfill transaction OR throws
   *    an error on failure
   */
  stellarFulfill(preimage) {
    return this.stellar.buyerWithdraw(
      this.trade.stellar.holdingAccount,
      this.stellarKeypair(),
      preimage,
      this.trade.stellar.amount
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
   * @throw Error trade record has bad addresses or doesn't reflect ledger state
   *          eg. holding account defined in trade does not exist on chain
   */
  async status() {
    if (!has(this.trade, 'initialSide') || !this.trade.initialSide)
      return Status.INIT
    return this.trade.initialSide === TradeSide.STELLAR
      ? this.statusStellarInitiatedTrade()
      : this.statusEthereumInitiatedTrade()
  }

  async statusStellarInitiatedTrade() {
    if (!has(this.trade.stellar, 'holdingAccount')) return Status.INIT

    const validHoldingAccount = await this.stellar.isValidHoldingAccount(
      this.trade.stellar.holdingAccount,
      this.trade.stellar.withdrawer,
      this.trade.commitment
    )
    const accountMerged = await this.stellar.holdingAccountMerged(
      this.trade.stellar.holdingAccount,
      this.trade.stellar.withdrawer
    )

    if (validHoldingAccount === false && accountMerged === false)
      return Status.INIT

    if (validHoldingAccount === true) {
      if ((await this.stellarRefundTxCreated()) === false)
        return Status.STELLAR_HOLDING_ACCOUNT
      if ((await this.stellarFundsDeposited()) === false)
        return Status.STELLAR_REFUND_TX
      if ((await this.isEthereumPrepared()) === false)
        return Status.STELLAR_DEPOSIT
      if ((await this.isEthereumFulfilled()) === false)
        return Status.ETHEREUM_HTLC
      if ((await this.isStellarFulfilled()) === false)
        return Status.ETHEREUM_WITHDRAW
    }

    return Status.FINALISED
  }

  async statusEthereumInitiatedTrade() {
    throw new Error('statusEthereumInitiatedTrade not yet implemented')
  }

  stellarRefundTxCreated() {
    const st = this.trade.stellar
    return Promise.resolve(
      has(st, 'refundTx') &&
        typeof st.refundTx === 'string' &&
        st.refundTx.length > 0
    )

    // TODO: validate the contents of the envelope
  }

  stellarFundsDeposited() {
    return this.stellar
      .getBalance(this.trade.stellar.holdingAccount)
      .then(balance => balance === this.trade.stellar.amount)
  }

  async isEthereumPrepared() {
    if (!has(this.trade.ethereum, 'htlcContractId')) {
      // no contract in trade record but look for one on the blockchain
      const contractId = await this.eth.findContract(
        this.trade.ethereum.depositor,
        this.trade.ethereum.withdrawer,
        this.trade.ethereum.amount,
        this.trade.commitment,
        this.trade.timelock
      )
      if (contractId) {
        this.trade.ethereum.htlcContractId = contractId
        this.tradeDB.save(this.trade)
      }
    }

    let prepared = false
    if (has(this.trade.ethereum, 'htlcContractId')) {
      const contract = await this.getContract(
        this.trade.ethereum.htlcContractId
      )
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

  isEthereumFulfilled() {
    return this.getContract(this.trade.ethereum.htlcContractId).then(
      contract => contract.withdrawn === true
    )
  }

  isStellarFulfilled() {
    return this.stellar
      .getBalance(this.trade.stellar.holdingAccount)
      .then(balance => balance === 0)
  }

  isStellarDepositor() {
    return this.trade.stellar.depositor === this.stellarPublicAddress()
  }

  isStellarWithdrawer() {
    return this.trade.stellar.withdrawer === this.stellarPublicAddress()
  }

  isEthereumDepositor() {
    return this.trade.ethereum.depositor === this.config.ethereumPublicAddress
  }

  isEthereumWithdrawer() {
    return this.trade.ethereum.withdrawer === this.config.ethereumPublicAddress
  }

  stellarKeypair() {
    return sdk.Keypair.fromSecret(this.config.stellarAccountSecret)
  }

  stellarPublicAddress() {
    return this.stellarKeypair().publicKey()
  }

  async getContract() {
    const contract = await this.eth.getContract(
      this.trade.ethereum.htlcContractId
    )
    const contractExists =
      contract.sender !== '0x0000000000000000000000000000000000000000'
    return contractExists ? contract : undefined
  }
}

Protocol.Status = Status
Protocol.TradeSide = TradeSide

export default Protocol
