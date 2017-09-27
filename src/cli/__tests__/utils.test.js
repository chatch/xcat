import expect from 'expect'
import {configFileArgOrDefault} from '../utils'

describe('cli utils', () => {
  describe('configFileArgOrDefault', () => {
    it('sets default config file when filename is blank', () => {
      expect(configFileArgOrDefault(undefined)).toEqual('./config.json')
      expect(configFileArgOrDefault('')).toEqual('./config.json')
      expect(configFileArgOrDefault('  ')).toEqual('./config.json')
      expect(configFileArgOrDefault('myconfig.json')).toEqual('myconfig.json')
    })
  })
})
