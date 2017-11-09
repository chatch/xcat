import chalk from 'chalk'
import sdk from 'stellar-sdk'
import Web3 from 'web3'

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

const log = msg => console.info(`INFO: ${msg}`)
const logError = msg =>
  console.error(chalk.red(`ERROR: ${JSON.stringify(msg, null, 2)}`))

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
  telehashHashname: 'NONE',
}

const main = async () => {
  /*
   * Give both stellar accounts some Lumens
   */
  const stellar = new sdk.Server('http://localhost:8000', {allowHttp: true})
  await stellar.friendbot(sBuyerKP.publicKey()).call()
  await stellar.friendbot(sSellerKP.publicKey()).call()

  /*
   * Party 1 initiates trade setting up Stellar side
   */
  const config1 = new Config(configParty1)
  let trade1 = new Trade(initialTrade)
  const protocol1 = new Protocol(config1, trade1)

  const initialStatus = await protocol1.status()
  log(`initial status: ${Protocol.Status.key(initialStatus)}`)

  trade1 = await protocol1.stellarPrepare()
  log(`stellar side prepared\ntrade id: ${trade1.id}`)

  /*
   * Party 2 receives the trade file and prepares the Ethereum side
   */
  let trade2 = trade1 // party 1 sends trade def to party 2
  const config2 = new Config(configParty2)
  const protocol2 = new Protocol(config2, trade2)
  const {htlcId, stellarRefundTx} = await protocol2.ethereumPrepare()
  log(`htlc created: ${htlcId}`)
  log(`refund tx for party 1 created: ${stellarRefundTx}`)

  /*
   * Party 1 receives the refund tx and deposits XLM into holding account
   */
}

main()
  .then(() => console.log(`finished`))
  .catch(logError)
