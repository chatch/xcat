import expect from 'expect'
import {sign, verify} from '../utils'
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
})
