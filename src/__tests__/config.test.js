import expect from 'expect'
import {clone} from '../utils'
import Config from '../config'

const config1 = require('./__data__/config1.json')

describe('config', () => {
  it('creates new Config that has all properties of the given config object', () => {
    const config = new Config(config1)
    Object.keys(config1).forEach(attr =>
      expect(config[attr]).toEqual(config1[attr])
    )
  })

  it('throws if config has a bad stellarPublicAddress', () => {
    const configBad = clone(config1)
    configBad.stellarAccountSecret = 'SCABCDEF'
    expect(() => new Config(configBad)).toThrowErrorMatchingSnapshot()
  })

  it('throws if config has a bad ethereumPublicAddress', () => {
    const configBad = clone(config1)
    configBad.ethereumPublicAddress = '0xabcdef'
    expect(() => new Config(configBad)).toThrowErrorMatchingSnapshot()
  })

  it('throws if unknown stellarNetwork', () => {
    const configBad = clone(config1)
    configBad.stellarNetwork = 'private'
    expect(() => new Config(configBad)).toThrowErrorMatchingSnapshot()
  })

  it('throws if config has a bad ethereumRPC', () => {
    const configBad = clone(config1)
    configBad.ethereumRPC = '//notaurl'
    expect(() => new Config(configBad)).toThrowErrorMatchingSnapshot()
  })

  it('provides property reference to derived stellar public key', () => {
    const configJSON = clone(config1)
    const config = new Config(configJSON)
    expect(config.stellarPublicAddress).toEqual(
      'GCOCD2SVBEOB4PWMS7FEOFM27TPSZBO5LFR24NBMT6Q73OIUKBKDKFBS'
    )
  })
})
