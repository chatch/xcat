import Ajv from 'ajv'
import {isStellarSecretSeed, isEthereumPublicAddress, isUrl} from './utils'

const ConfigSchema = require('./schema/config.json')

const configValidator = () => {
  const opts = {
    verbose: true,
    allErrors: true,
  }
  const ajv = new Ajv(opts)
  ajv.addFormat('stellarSecretSeed', isStellarSecretSeed)
  ajv.addFormat('ethereumPublicAddress', isEthereumPublicAddress)
  ajv.addFormat('URL', isUrl) // ajv url format fails  http://localhost so roll our own
  ajv.addSchema(ConfigSchema, 'Config')
  return {validator: ajv.compile(ConfigSchema), ajv: ajv}
}
const {validator, ajv} = configValidator()

class Config {
  /**
   * Create a new Config and validate the given JSON / object.
   *
   * @param config JSON string or object
   * @return Config instance
   * @throws Error with details if config doesn't conform to schema
   */
  constructor(config) {
    const valid = validator(config)
    if (!valid)
      throw new Error(
        `config doesn't conform to schema config.json [\n` +
          `\tmessage: "${ajv.errorsText(validator.errors)}"\n` +
          `\traw: ${JSON.stringify(validator.errors, null, 2)}` +
          `]`
      )
    Object.assign(this, config)
  }
}

export default Config
