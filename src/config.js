import Ajv from 'ajv'
import {
  isStellarSecretSeed,
  isEthereumPublicAddress,
  isUrl,
  objToStr,
} from './utils'

const ConfigSchema = require('./schema/config.json')

const {validator, ajv} = (() => {
  const ajv = new Ajv({allErrors: true})
  ajv.addFormat('stellarSecretSeed', isStellarSecretSeed)
  ajv.addFormat('ethereumPublicAddress', isEthereumPublicAddress)
  ajv.addFormat('URL', isUrl) // ajv url format fails  http://localhost so roll our own
  ajv.addSchema(ConfigSchema, 'Config')
  return {validator: ajv.compile(ConfigSchema), ajv: ajv}
})()

class Config {
  static validate(config) {
    return validator(config)
  }

  /**
   * Create a new Config and validate the given JSON / object.
   *
   * @param config JSON string or object
   * @return Config instance
   * @throws Error with details if config doesn't conform to schema
   */
  constructor(config) {
    const valid = Config.validate(config)
    if (!valid)
      throw new Error(
        `config doesn't conform to schema config.json [\n` +
          `\tmessage: "${ajv.errorsText(validator.errors)}"\n` +
          `\traw: ${objToStr(validator.errors)}` +
          `]`
      )
    Object.assign(this, config)
  }
}

export default Config
