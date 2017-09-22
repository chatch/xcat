import sdk from 'stellar-sdk'
const Op = sdk.Operation

const initServer = (sdk, network) => {
  let horizonUrl
  if (network === 'public') {
    sdk.Network.usePublicNetwork()
    horizonUrl = 'https://horizon.stellar.org'
  } else {
    sdk.Network.useTestNetwork()
    horizonUrl = 'https://horizon-testnet.stellar.org'
  }
  return new sdk.Server(horizonUrl, {allowHttp: false})
}

class Stellar {
  constructor(sdk, network) {
    this.sdk = sdk
    this.server = initServer(sdk, network)
  }

  createHoldingAccountTx(
    sellerAccount,
    sellerPublicAddr,
    buyerPublicAddr,
    hashX
  ) {
    const tb = new sdk.TransactionBuilder(sellerAccount)

    // Op1: Create holding account
    const newAccKeypair = sdk.Keypair.random()
    tb.addOperation(
      Op.createAccount({
        destination: newAccKeypair.publicKey(),
        startingBalance: '40', // +20 base; +10 hash(x) signer; +10 buyer signer
      })
    )

    // Op2: Add buyer as signer on holding account
    tb.addOperation(
      Op.setOptions({
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
      Op.setOptions({
        source: newAccKeypair.publicKey(),
        signer: {
          sha256Hash: hashX,
          weight: 1,
        },
        masterWeight: 0,
        lowThreshhold: 2,
        medThreshhold: 2,
        highThreshhold: 2,
      })
    )

    const tx = tb.build()
    tx.sign(newAccKeypair, sellerAccount)
    return tx
  }

  /**
   * Buyer creates and signs a refund tx for the seller for the case the
   * transfer does not complete. The seller can add their signature
   * (or the hash(x) signature depending on the setup) to make the refund tx
   * valid.
   */
  sellerRefundTx(holdingAccount, sellerKeypair, locktime, amount) {
    const tb = new sdk.TransactionBuilder(holdingAccount, {
      timeBounds: {minTime: locktime},
    })

    tb.addOperation(
      Op.payment({
        destination: sellerKeypair.publicKey(),
        startingBalance: String(amount),
      })
    )

    const tx = tb.build()
    tx.sign(sellerKeypair)
    return tx
  }

  /**
   * Seller deposits funds into the holding account tx..
   */
  sellerDepositTx(sellerAccount, sellerKeypair, holdingAccPublicAddr, amount) {
    const tb = new sdk.TransactionBuilder(sellerAccount)

    tb.addOperation(
      Op.payment({
        destination: holdingAccPublicAddr,
        startingBalance: String(amount),
      })
    )

    const tx = tb.build()
    tx.sign(sellerKeypair)
    return tx
  }

  /**
   * Buyer withdraws funds from the holding account tx revealing preimage (x)
   * by adding x as a signer.
   */
  buyerWithdrawTx(holdingAccount, buyerKeypair, preimage, amount) {
    const tb = new sdk.TransactionBuilder(holdingAccount)

    tb.addOperation(
      Op.payment({
        destination: buyerKeypair.publicKey(),
        startingBalance: String(amount),
      })
    )

    const tx = tb.build()
    tx.sign(buyerKeypair, preimage)
    return tx
  }
}

export default Stellar
