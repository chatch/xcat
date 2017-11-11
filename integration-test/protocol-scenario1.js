import chalk from 'chalk'
import sdk from 'stellar-sdk'
import Web3 from 'web3'
import expect from 'expect'
import Promise from 'bluebird'

import Config from '../src/config'
import Trade from '../src/trade'
import Protocol from '../src/protocol'

import {newSecretHashPair} from '../src/utils'

/**
 * An end-to-end full test of scenario 1 of the protocol documented at
 * https://github.com/chatch/xcat/blob/master/docs/protocol_stellar_xlm_to_ethereum_eth.md
 *
 * Runs against local Stellar and Ethereum nodes both of which need to be started
 * before the script is run.
 */

/*
 * Ethereum Accounts
 */
const web3 = new Web3(new Web3.providers.HttpProvider())
const eSellerAddr = web3.eth.accounts[4]
const eBuyerAddr = web3.eth.accounts[5]

/*
 * Stellar Accounts
 */
const sBuyerKP = sdk.Keypair.random()
const sSellerKP = sdk.Keypair.random()

/*
 * Trade definition
 */
const {secret: preImageStr, hash: hashXStr} = newSecretHashPair()

const initialTrade = {
  initialSide: Protocol.TradeSide.STELLAR,
  timelock: Date.now() + 120,
  commitment: hashXStr.substring(2),
  stellar: {
    token: 'XLM',
    amount: 200.0,
    depositor: sSellerKP.publicKey(),
    withdrawer: sBuyerKP.publicKey(),
  },
  ethereum: {
    token: 'ETH',
    amount: 0.01,
    depositor: eSellerAddr,
    withdrawer: eBuyerAddr,
  },
}

/*
 * Config for each party
 */

// party1: selling XLM, buying ETH
const configParty1 = {
  stellarNetwork: 'localnet',
  stellarAccountSecret: sSellerKP.secret(),
  ethereumNetwork: 'testrpc',
  ethereumRPC: 'http://localhost:8545',
  ethereumPublicAddress: eBuyerAddr,
}

// party2: selling ETH, buying XLM
const configParty2 = {
  stellarNetwork: 'localnet',
  stellarAccountSecret: sBuyerKP.secret(),
  ethereumNetwork: 'testrpc',
  ethereumRPC: 'http://localhost:8545',
  ethereumPublicAddress: eSellerAddr,
}

const log = msg => console.info(`INFO: ${msg}`)
const logError = msg =>
  console.error(chalk.red(`ERROR: ${JSON.stringify(msg, null, 2)}`))

const main = async () => {
  /*
   * Party 1 initiates trade setting up the Stellar holding account (2.2)
   */
  const config1 = new Config(configParty1)
  let trade1 = new Trade(initialTrade)
  const protocol1 = new Protocol(config1, trade1)
  expect(await protocol1.status()).toEqual(Protocol.Status.INIT)

  trade1 = await protocol1.stellarPrepare()
  log(`trade id generated: ${trade1.id}`)
  log(
    `stellar holding account created: ${protocol1.trade.stellar.holdingAccount}`
  )
  expect(await protocol1.status()).toEqual(
    Protocol.Status.STELLAR_HOLDING_ACCOUNT
  )

  /*
   * Party 2 receives the trade file and checks the status
   */
  let trade2 = trade1 // party 1 sends trade def to party 2
  const config2 = new Config(configParty2)
  const protocol2 = new Protocol(config2, trade2)
  expect(await protocol2.status()).toEqual(
    Protocol.Status.STELLAR_HOLDING_ACCOUNT
  )
  log(`party2 imported and checked the trade status`)

  /*
   * Party 2 generates the refund tx for Party 1 (2.3)
   */
  trade2.stellar.refundTx = await protocol2.stellarRefundTx()
  expect(await protocol2.status()).toEqual(Protocol.Status.STELLAR_REFUND_TX)
  log(`refund tx for party 1 created: [${trade2.stellar.refundTx}]`)

  /*
   * Party 1 receives the refund tx and deposits XLM into holding account (2.4)
   */
  trade1.stellar.refundTx = trade2.stellar.refundTx // party 2 sends tx to party 1
  expect(await protocol1.status()).toEqual(Protocol.Status.STELLAR_REFUND_TX)
  // TODO:
  //  protocol.validate the refundtx !
  await protocol1.stellarDeposit(sSellerKP)
  expect(await protocol1.status()).toEqual(Protocol.Status.STELLAR_DEPOSIT)
  expect(await protocol2.status()).toEqual(Protocol.Status.STELLAR_DEPOSIT)
  log(`party1 deposited XLM`)

  /*
   * Party 2 creates the HTLC and deposits ETH (2.5)
   */
  const htlcId = await protocol2.ethereumPrepare()
  log(`htlc created: ${htlcId}`)
  expect(await protocol2.status()).toEqual(Protocol.Status.ETHEREUM_HTLC)
  expect(await protocol1.status()).toEqual(Protocol.Status.ETHEREUM_HTLC)

  /*
   * Party 1 withdraws the ETH revealing the preimage (3.1)
   */
  const ethWithdrawTxHash = await protocol1.ethereumFulfill(preImageStr)
  log(`ETH withdrawn (tx:${ethWithdrawTxHash}`)
  expect(await protocol1.status()).toEqual(Protocol.Status.ETHEREUM_WITHDRAW)
  expect(await protocol2.status()).toEqual(Protocol.Status.ETHEREUM_WITHDRAW)

  /*
   * Party 2 withdraws the XLM revealing the preimage (3.1)
   */
  // TODO: pull the preimage from the events log ...
  //        for now cheat and just plug it in ..
  const stellarWithdrawTxHash = await protocol2.stellarFulfill(preImageStr)
  log(`XLM withdrawn (tx:${stellarWithdrawTxHash}`)
  expect(await protocol2.status()).toEqual(Protocol.Status.FINALISED)
  expect(await protocol1.status()).toEqual(Protocol.Status.FINALISED)

  log(`FINALISED!`)
}

/*
 * Main - give both stellar accounts some Lumens then run main()
 */
const stellar = new sdk.Server('http://localhost:8000', {allowHttp: true})
Promise.all([
  stellar.friendbot(sBuyerKP.publicKey()).call(),
  stellar.friendbot(sSellerKP.publicKey()).call(),
]).then(main)
