import crypto from 'crypto'
import {readFileSync, writeFileSync} from 'fs'
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

const fileToStr = filename => readFileSync(filename).toString()
const fileToObj = filename => JSON.parse(fileToStr(filename))
const strToFile = (filename, str) => writeFileSync(filename, str)
const objToStr = obj => JSON.stringify(obj, null, 2)
const objToFile = (filename, obj) => strToFile(filename, objToStr(obj))

/**
 * Produce a Ed25519 signature given signing key and a string to sign
 * @param secretKey Stellar account secret key for signing
 * @param dataStr A string to be sign
 * @return signature in Base64
 */
const sign = (secretKey, dataStr) => {
  const kp = stellarSdk.Keypair.fromSecret(secretKey)
  const dataBuf = Buffer.from(dataStr, 'utf8')
  const sigBuf = kp.sign(dataBuf)
  return sigBuf.toString('base64')
}

/**
 * Verify an Ed25519 signature of a string
 * @param publicKey Public key of the signer Stellar account
 * @param sigBase64 Signature in Base64
 * @param dataStr String that was signed
 * @return true if sigHex for dataStr is valid
 */
const verify = (publicKey, sigBase64, dataStr) => {
  const kp = stellarSdk.Keypair.fromPublicKey(publicKey)
  const sigBuf = Buffer.from(sigBase64, 'base64')
  const dataBuf = Buffer.from(dataStr, 'utf8')
  return kp.verify(dataBuf, sigBuf)
}

export {
  bufToStr,
  clone,
  fileToObj,
  fileToStr,
  isStellarPublicAddress,
  isStellarSecretSeed,
  isStellarFederatedAddress,
  isEthereumPublicAddress,
  isClassWithName,
  isUrl,
  newSecretHashPair,
  objToFile,
  objToStr,
  random32,
  sha256,
  sign,
  strToFile,
  verify,
}
