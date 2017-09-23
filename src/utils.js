import crypto from 'crypto'
import {URL} from 'url'
import stellarSdk from 'stellar-sdk'
import Web3Utils from 'web3-utils'
import hasIn from 'lodash/hasIn'

// Format required for sending bytes through an eth js client:
//  - hex string representation
//  - prefixed with 0x
const bufToStr = b => '0x' + b.toString('hex')

const clone = obj => JSON.parse(JSON.stringify(obj))

const sha256 = x =>
  crypto
    .createHash('sha256')
    .update(x)
    .digest()

const random32 = () => crypto.randomBytes(32)

const newSecretHashPair = () => {
  const secret = random32()
  const hash = sha256(secret)
  return {
    secret: bufToStr(secret),
    hash: bufToStr(hash),
  }
}

const isStellarPublicAddress = addr =>
  stellarSdk.StrKey.isValidEd25519PublicKey(addr)
const isStellarSecretSeed = addr =>
  stellarSdk.StrKey.isValidEd25519SecretSeed(addr)
const isStellarFederatedAddress = addr => /^[^*,]*\*[a-z0-9-.]*$/i.test(addr)

const isEthereumPublicAddress = addr => Web3Utils.isAddress(addr)

const isUrl = url => {
  try {
    new URL(url)
    return true
  } catch (e) {
    return false
  }
}

const isClassWithName = (cls, name) =>
  hasIn(cls, 'constructor.name') && cls.constructor.name === name

export {
  bufToStr,
  clone,
  newSecretHashPair,
  random32,
  sha256,
  isStellarPublicAddress,
  isStellarSecretSeed,
  isStellarFederatedAddress,
  isEthereumPublicAddress,
  isClassWithName,
  isUrl,
}
