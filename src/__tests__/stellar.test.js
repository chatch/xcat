import expect from 'expect'
import Promise from 'bluebird'
import sdk from 'stellar-sdk'
import Stellar from '../stellar'
import {clone, stellarEncodeHash} from '../utils'

import {AccountResponse} from 'stellar-sdk/lib/account_response'
import loadAccountRspHoldAcc from './__data__/loadAccountRsp_holdingAccount'

/*
 * Test Data
 */

const HOLDING_ACC = 'GCVG6GGMTEOERQ2QRALNLITHULKRHPUJE6RON7B2H5PEGLTODFD6DTLD'
const WITHDRAWER_ACC =
  'GCG52B2LBYVTPUCIQFDB7VBXARK4OUV5NSEQ5R6T343FW7GR4MBUM3V6'
const RANDOM_ACC = sdk.Keypair.random().publicKey()

const HASH_X =
  '22bf0b3d38d2bec7226eeafd6571cdd452d34a79fb4e72f98e246d372c6a9855'
const HASH_X_STELLAR_ENCODING = stellarEncodeHash(HASH_X)

const SIGNERS = [
  {
    public_key: HASH_X_STELLAR_ENCODING,
    weight: 1,
    key: HASH_X_STELLAR_ENCODING,
    type: 'sha256_hash',
  },
  {
    public_key: WITHDRAWER_ACC,
    weight: 1,
    key: WITHDRAWER_ACC,
    type: 'ed25519_public_key',
  },
  {
    public_key: HOLDING_ACC,
    weight: 0,
    key: HOLDING_ACC,
    type: 'ed25519_public_key',
  },
]

describe('stellar', () => {
  let st

  beforeEach(() => {
    st = new Stellar(sdk, 'testnet')
    // mock loadAccount - return a holding account
    st.server.loadAccount = () =>
      new Promise(resolve =>
        resolve(new AccountResponse(loadAccountRspHoldAcc))
      )
  })

  it('creates a new instance for public network', () => {
    const stPub = new Stellar(sdk, 'public')
    expect(stPub.server.serverURL.toString()).toEqual(
      'https://horizon.stellar.org/'
    )
    expect(stPub.sdk.Network.current()._networkPassphrase).toEqual(
      sdk.Networks.PUBLIC
    )
  })

  it('creates a new instance for test network', () => {
    const stTest = new Stellar(sdk, 'testnet')
    expect(stTest.server.serverURL.toString()).toEqual(
      'https://horizon-testnet.stellar.org/'
    )
    expect(stTest.sdk.Network.current()._networkPassphrase).toEqual(
      sdk.Networks.TESTNET
    )
  })

  describe('validHoldingAccountSignerSetup', () => {
    const expectValid = (opts = {}, valid = true) => {
      expect(
        Stellar.validHoldingAccountSignerSetup(
          opts.signers ? opts.signers : SIGNERS,
          opts.holdingAcc ? opts.holdingAcc : HOLDING_ACC,
          opts.withdrawer ? opts.withdrawer : WITHDRAWER_ACC,
          opts.hashX ? opts.hashX : HASH_X
        )
      ).toEqual(valid)
    }

    it('passes correct set of signers', () => {
      expectValid()
    })

    it('fails a non matching hashX', () => {
      const DIFF_HASH = HASH_X.replace('a', 'f')
      expectValid({hashX: DIFF_HASH}, false)
    })

    it('fails a non matching withdrawer', () => {
      expectValid({withdrawer: RANDOM_ACC}, false)
    })

    it('fails if master key weight non 0', () => {
      const SIGNERS_MASTER_NON_ZERO = clone(SIGNERS)
      SIGNERS_MASTER_NON_ZERO[2].weight = 1
      expectValid({signers: SIGNERS_MASTER_NON_ZERO}, false)
    })

    it('fails if withdrawer key weight not 1', () => {
      const SIGNERS_WITHDRAWER_NOT_ONE = clone(SIGNERS)
      SIGNERS_WITHDRAWER_NOT_ONE[1].weight = 2
      expectValid({signers: SIGNERS_WITHDRAWER_NOT_ONE}, false)
    })

    it('fails if hashx key weight not 1', () => {
      const SIGNERS_HASH_X_NOT_ONE = clone(SIGNERS)
      SIGNERS_HASH_X_NOT_ONE[0].weight = 2
      expectValid({signers: SIGNERS_HASH_X_NOT_ONE}, false)
    })
  })

  describe('validHoldingAccountThresholds', () => {
    const thresholds = (l, m, h) => {
      return {low_threshold: l, med_threshold: m, high_threshold: h}
    }
    const expectValid = (l, m, h, valid = true) =>
      expect(
        Stellar.validHoldingAccountThresholds(thresholds(l, m, h))
      ).toEqual(valid)

    it('returns true for a valid thesholds', () => {
      expectValid(2, 2, 2)
    })

    it('returns false for invalid thresholds', () => {
      expectValid(1, 2, 2, false)
      expectValid(2, 1, 2, false)
      expectValid(2, 2, 1, false)
      expectValid(0, 0, 0, false)
      expectValid(1, 1, 1, false)
      expectValid(2, 2, 3, false)
    })
  })

  describe('isValidHoldingAccount', () => {
    it('returns true for a valid holding account', async () => {
      const retVal = await st.isValidHoldingAccount(
        'GCVG6GGMTEOERQ2QRALNLITHULKRHPUJE6RON7B2H5PEGLTODFD6DTLD',
        'GCG52B2LBYVTPUCIQFDB7VBXARK4OUV5NSEQ5R6T343FW7GR4MBUM3V6',
        '22bf0b3d38d2bec7226eeafd6571cdd452d34a79fb4e72f98e246d372c6a9855'
      )
      expect(retVal).toEqual(true)
    })

    it('returns false if holding account does not exist', async () => {
      st.server.loadAccount = () =>
        new Promise(() => {
          throw new st.sdk.NotFoundError()
        })
      const retVal = await st.isValidHoldingAccount(
        'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG'
      )
      expect(retVal).toEqual(false)
    })
  })

  describe('sellerRefundTxEnvelope()', () => {
    const holdingAccPublicKey = HOLDING_ACC
    const buyerKP = sdk.Keypair.random()
    const sellerKP = sdk.Keypair.random()
    const locktime = Date.now() + 3600 // 1hr
    const amount = 1000 // XLM

    it('generates and signs the transaction', async () => {
      const txEnvelopeStr = await st.sellerRefundTxEnvelope(
        holdingAccPublicKey,
        buyerKP,
        sellerKP.publicKey(),
        locktime,
        amount
      )

      const txEnvelope = sdk.xdr.TransactionEnvelope.fromXDR(
        txEnvelopeStr,
        'base64'
      )
      const tx = new sdk.Transaction(txEnvelope)

      expect(tx.source).toEqual(holdingAccPublicKey)
      expect(tx.timeBounds.minTime).toEqual(String(locktime))
      expect(tx.timeBounds.maxTime).toEqual('0')

      expect(tx.operations.length).toEqual(1)
      const payOp = tx.operations[0]
      expect(payOp.type).toEqual('payment')
      expect(payOp.amount).toEqual(String(amount))
      expect(payOp.destination).toEqual(sellerKP.publicKey())

      const sigs = txEnvelope.signatures()
      expect(sigs.length).toEqual(1)
    })
  })
})
