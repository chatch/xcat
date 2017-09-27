import expect from 'expect'
import sdk from 'stellar-sdk'
import Stellar from '../stellar'

describe('stellar', () => {
  it('creates a new instance for public network', () => {
    const st = new Stellar(sdk, 'public')
    expect(st.server.serverURL.toString()).toEqual(
      'https://horizon.stellar.org/'
    )
    expect(st.sdk.Network.current()._networkPassphrase).toEqual(
      sdk.Networks.PUBLIC
    )
  })

  it('creates a new instance for test network', () => {
    const st = new Stellar(sdk, 'testnet')
    expect(st.server.serverURL.toString()).toEqual(
      'https://horizon-testnet.stellar.org/'
    )
    expect(st.sdk.Network.current()._networkPassphrase).toEqual(
      sdk.Networks.TESTNET
    )
  })

  describe('calling isValidHoldingAccount', () => {
    const st = new Stellar(sdk, 'testnet')

    it('returns true for a valid holding account', async () => {
      const retVal = await st.isValidHoldingAccount(
        'GCVG6GGMTEOERQ2QRALNLITHULKRHPUJE6RON7B2H5PEGLTODFD6DTLD',
        'GCOCD2SVBEOB4PWMS7FEOFM27TPSZBO5LFR24NBMT6Q73OIUKBKDKFBS',
        'GCG52B2LBYVTPUCIQFDB7VBXARK4OUV5NSEQ5R6T343FW7GR4MBUM3V6',
        '22bf0b3d38d2bec7226eeafd6571cdd452d34a79fb4e72f98e246d372c6a9855'
      )
      expect(retVal).toEqual(true)
    })

    it('returns false if holding account does not exist', async () => {
      const retVal = await st.isValidHoldingAccount(
        'GCVGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG'
      )
      expect(retVal).toEqual(false)
    })
  })
})
