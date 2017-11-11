import {stellarEncodeHash} from './utils'

const initServer = (sdk, network) => {
  let allowHttp = false
  let horizonUrl
  if (network === 'public') {
    horizonUrl = 'https://horizon.stellar.org'
    sdk.Network.usePublicNetwork()
  } else if (network === 'testnet') {
    horizonUrl = 'https://horizon-testnet.stellar.org'
    sdk.Network.useTestNetwork()
  } else {
    horizonUrl = 'http://localhost:8000'
    sdk.Network.use(new sdk.Network('Integration Test Network ; zulucrypto'))
    allowHttp = true
  }
  return new sdk.Server(horizonUrl, {allowHttp: allowHttp})
}

const matchOne = (array, matcherFn) => array.filter(matcherFn).length === 1

const matchSigner = (signer, type, key, weight) =>
  signer.type === type && signer.key === key && signer.weight === weight

/**
 * Interface to the Stellar network providing implementations of required xcat
 * transactions as well as routines to check the state of the ledger.
 */

class Stellar {
  static validHoldingAccountSignerSetup(
    signers,
    accAddress,
    withdrawer,
    hashX
  ) {
    return (
      signers.length === 3 &&
      matchOne(signers, s =>
        matchSigner(s, 'ed25519_public_key', withdrawer, 1)
      ) &&
      matchOne(signers, s =>
        matchSigner(s, 'ed25519_public_key', accAddress, 0)
      ) &&
      matchOne(signers, s =>
        matchSigner(s, 'sha256_hash', stellarEncodeHash(hashX), 1)
      )
    )
  }

  static validHoldingAccountThresholds(thresholds) {
    return (
      thresholds.low_threshold === 2 &&
      thresholds.med_threshold === 2 &&
      thresholds.high_threshold === 2
    )
  }

  constructor(sdk, network) {
    this.sdk = sdk
    this.server = initServer(sdk, network)
  }

  async createHoldingAccount(
    newAccKeypair,
    sellerKeypair,
    buyerPublicAddr,
    hashX
  ) {
    const sellerAccount = await this.loadAccount(sellerKeypair.publicKey())
    const tx = this.createHoldingAccountTx(
      newAccKeypair,
      sellerAccount,
      buyerPublicAddr,
      hashX
    )
    tx.sign(sellerKeypair, newAccKeypair)
    return this.server.submitTransaction(tx)
  }

  createHoldingAccountTx(newAccKeypair, sellerAccount, buyerPublicAddr, hashX) {
    const tb = new this.sdk.TransactionBuilder(sellerAccount)

    // Op1: Create holding account
    tb.addOperation(
      this.sdk.Operation.createAccount({
        destination: newAccKeypair.publicKey(),
        startingBalance: '40', // +20 base; +10 hash(x) signer; +10 buyer signer
      }) // TODO: don't use 10 .. pull value of base from latest ledger
    )

    // Op2: Add buyer as signer on holding account
    tb.addOperation(
      this.sdk.Operation.setOptions({
        source: newAccKeypair.publicKey(),
        signer: {
          ed25519PublicKey: buyerPublicAddr,
          weight: 1,
        },
      })
    )

    // Op3: Configure signing thresholds and add Hash(x) signer:
    //  - add hash(x) as signer on holding account with weight 1
    //  - set master weight to 0 (so holding account can't sign it's own txs)
    //  - set thresholds for all signing levels to 2 so 2 signatures are required
    tb.addOperation(
      this.sdk.Operation.setOptions({
        source: newAccKeypair.publicKey(),
        signer: {
          sha256Hash: hashX,
          weight: 1,
        },
        masterWeight: 0,
        lowThreshold: 2,
        medThreshold: 2,
        highThreshold: 2,
      })
    )

    return tb.build()
  }

  /**
   * Validates a given holding account exists and is setup correctly.
   *
   * @param holdingAccountAddress Holding account public key
   * @param withdrawerAddress Address of the withdrawer
   * @param hashX Hash(x) signer hash
   */
  async isValidHoldingAccount(holdingAccountAddress, withdrawerAddress, hashX) {
    const acc = await this.server
      .loadAccount(holdingAccountAddress)
      .catch(this.sdk.NotFoundError, () => undefined)
      .catch(e => {
        console.error(
          `unknown error fetching account ${holdingAccountAddress}`,
          e
        )
        throw e
      })

    if (!acc) return false

    return (
      Stellar.validHoldingAccountSignerSetup(
        acc.signers,
        holdingAccountAddress,
        withdrawerAddress,
        hashX
      ) && Stellar.validHoldingAccountThresholds(acc.thresholds)
    )
  }

  /**
   * Buyer creates and signs a refund tx for the seller for the case the
   * transfer does not complete. The seller can add their signature
   * (or the hash(x) signature depending on the setup) to make the refund tx
   * valid.
   * @return transaction envelope as a base64 string
   */
  async sellerRefundTxEnvelope(
    holdingAccountPublicKey,
    buyerKeypair,
    sellerPublicAddr,
    locktime,
    amount
  ) {
    const holdingAccount = await this.loadAccount(holdingAccountPublicKey)

    const tb = new this.sdk.TransactionBuilder(holdingAccount, {
      timebounds: {minTime: locktime, maxTime: 0},
    })

    tb.addOperation(
      this.sdk.Operation.payment({
        destination: sellerPublicAddr,
        amount: String(amount),
        asset: this.sdk.Asset.native(),
      })
    )

    const tx = tb.build()
    tx.sign(buyerKeypair)
    return tx.toEnvelope().toXDR('base64')
  }

  async sellerDeposit(sellerKeypair, holdingAccPublicAddr, amount) {
    const sellerAccount = await this.loadAccount(sellerKeypair.publicKey())

    const tx = this.sellerDepositTx(
      sellerAccount,
      sellerKeypair,
      holdingAccPublicAddr,
      amount
    )
    tx.sign(sellerKeypair)

    return this.server
      .submitTransaction(tx)
      .then(txRsp => txRsp.hash)
      .catch(err => {
        throw new Error(`Stellar tx error: ${JSON.stringify(err, null, 2)}`)
      })
  }

  /**
   * Seller deposits funds into the holding account tx..
   */
  sellerDepositTx(sellerAccount, sellerKeypair, holdingAccPublicAddr, amount) {
    return new this.sdk.TransactionBuilder(sellerAccount)
      .addOperation(
        this.sdk.Operation.payment({
          destination: holdingAccPublicAddr,
          amount: String(amount),
          asset: this.sdk.Asset.native(),
        })
      )
      .build()
  }

  /**
   * Buyer withdraws funds from the holding account tx revealing preimage (x)
   * by adding x as a signer.

   * @return Transaction hash on success; throws Error with transaction error details on failure
   */
  async buyerWithdraw(holdingAccountPublicKey, buyerKeypair, preimage, amount) {
    const holdingAccount = await this.loadAccount(holdingAccountPublicKey)

    const tx = this.buyerWithdrawTx(
      holdingAccount,
      buyerKeypair.publicKey(),
      amount
    )

    if (preimage.startsWith('0x')) preimage = preimage.substring(2)

    tx.sign(buyerKeypair)
    tx.signHashX(preimage)

    return this.server
      .submitTransaction(tx)
      .then(txRsp => txRsp.hash)
      .catch(err => {
        throw new Error(`Stellar tx error: ${JSON.stringify(err, null, 2)}`)
      })
  }

  /**
   * Create transaction for the buyer withdrawal: buyer withdraws funds from
   *  the holding account tx revealing preimage (x) by adding x as a signer.
   */
  buyerWithdrawTx(holdingAccount, buyerPublicKey, amount) {
    const tb = new this.sdk.TransactionBuilder(holdingAccount)
    tb.addOperation(
      this.sdk.Operation.payment({
        destination: buyerPublicKey,
        amount: String(amount),
        asset: this.sdk.Asset.native(),
      })
    )
    return tb.build()
  }

  async loadAccount(publicKey) {
    return this.server.loadAccount(publicKey)
  }

  async getBalance(publicKey) {
    return this.loadAccount(publicKey).then(accRec => {
      const xlmBalance = Number(
        accRec.balances.filter(b => (b.asset_type = 'native'))[0].balance
      )
      return xlmBalance
    })
  }
}

export default Stellar
