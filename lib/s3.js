const AWS = require('aws-sdk')
const Promise = require('bluebird')

class S3 {
  static initClass() {
    this.deps = {
      services: ['config'],
    }
  }

  validateRequiredConstructorValues(options, config) {
    const { error } = options

    if (!config.accessKey) {
      throw new error.MissingArg(
        'You are missing your S3 Access Key. This value is in your Blueprint config (s3_creds > accessKey)'
      )
    }

    if (!config.secretKey) {
      throw new error.MissingArg(
        'You are missing your S3 Secret Key. This value is in your Blueprint config (s3_creds > secretKey)'
      )
    }

    if (!config.region) {
      throw new error.MissingArg(
        'You are missing your S3 Region. This value is in your Blueprint config (s3_creds > region)'
      )
    }
  }

  constructor(kit) {
    this.module = `Blueprint`
    this.resource = `S3`
    this.f = `${this.module}::${this.resource}`

    // SERVICES
    this.E = kit.services.error
    this.config = kit.services.config.s3_creds
    this.log = kit.services.logger.log

    const options = {
      error: this.E,
    }
    this.validateRequiredConstructorValues(options, this.config)

    // AWS CONFIG
    AWS.config.update({
      accessKeyId: this.config.accessKey,
      secretAccessKey: this.config.secretKey,
      region: this.config.region,
    })

    this.s3 = new AWS.S3({ apiVersion: '2006-03-01' })
    this._putObject = Promise.promisify(this.s3.putObject).bind(this.s3)

    // FUNCTIONS
    this.upload = this.upload.bind(this)

    // FUNCTION HELPERS
    this.errorMap = {
      MISSING_BUCKET: 'You are missing your bucket name.',
      MISSING_KEY: 'You are missing your key (the name of the file). ',
    }
  }

  _validateUploadParamaters(params) {
    if (!params.Bucket) {
      throw new this.E.MissingArg(
        `${this.f} :>> ${this.errorMap['MISSING_BUCKET']}`
      )
    }

    if (!params.Key) {
      throw new this.E.MissingArg(
        `${this.f} :>> ${this.errorMap['MISSING_KEY']}`
      )
    }
  }

  /*
    const params = {
      Body: buffer,
      Bucket: this.config.profile_img_bucket,
      Key: key,
      ContentEncoding: 'buffer',
      ContentType: 'image/jpeg',
      ACL: 'public-read',
    }

    return : {
        url : String : location of where in S3 file was uploaded to,
        error : Error : error, if there is one
    }
  */
  async upload(params) {
    const f = `${this.f}::upload :>>`
    this.log.debug(`${f}`, { params })

    const send = {
      url: false,
      error: false,
    }

    this._validateUploadParamaters(params)
    await this._putObject(params)

    const url = `https://s3.amazonaws.com/${params.Bucket}/${params.Key}`
    send.url = url
    return send
  }

  // TODO: Get images from S3 function
}

S3.initClass()
exports.S3 = S3
