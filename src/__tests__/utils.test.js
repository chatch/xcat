import expect from 'expect'
import {isSha256Hash, sign, stellarEncodeHash, verify} from '../utils'
import stellarSdk from 'stellar-sdk'

// https://stackoverflow.com/a/8571649
const BASE64_STRING_REGEX = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)$/

describe('utils', () => {
  it('has working sign and verify routines', () => {
    const blobStr = 'a string to test sign and verify with'
    const signingKp = stellarSdk.Keypair.random()

    const sig = sign(signingKp.secret(), blobStr)
    expect(sig).toEqual(expect.stringMatching(BASE64_STRING_REGEX))

    const verifyResult = verify(signingKp.publicKey(), sig, blobStr)
    expect(verifyResult).toEqual(true)
  })

  describe('isSha256Hash', () => {
    it('correctly identifies sha256 hashes', () => {
      expect(isSha256Hash()).toEqual(false)
      expect(isSha256Hash('')).toEqual(false)
      expect(isSha256Hash(null)).toEqual(false)
      expect(isSha256Hash('1234567890abcdef')).toEqual(false)
      expect(isSha256Hash('0x123456789')).toEqual(false)
      expect(
        isSha256Hash(
          '60275d4c13b532f44d708de3ed59b80a04785fd68e50a1c8462c83632675b038'
        )
      ).toEqual(true)
      expect(
        isSha256Hash(
          '0x60275d4c13b532f44d708de3ed59b80a04785fd68e50a1c8462c83632675b038'
        )
      ).toEqual(true)
    })
  })

  describe('stellarEncodeHash', () => {
    it('encodes sha256 hash to Stellars internal hashx signer form', () => {
      expect(
        stellarEncodeHash(
          '22bf0b3d38d2bec7226eeafd6571cdd452d34a79fb4e72f98e246d372c6a9855'
        )
      ).toEqual('XARL6CZ5HDJL5RZCN3VP2ZLRZXKFFU2KPH5U44XZRYSG2NZMNKMFKVAT')
    })
  })
})
