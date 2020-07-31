const puppeteer = require('puppeteer')

class PDF {
  static initClass() {
    this.deps = { services: ['template', 's3'] }
  }

  constructor(kit) {
    this.module = `Blueprint`
    this.resource = `PDF`
    this.f = `${this.module}::${this.resource}`
    this.log = kit.services.logger.log
    this.E = kit.services.error
    this.template = kit.services.template
    this.config = kit.services.config
    this.s3 = kit.services.s3
  }

  async _getPdfBuffer(data) {
    const pdfOptions = { format: 'Letter' }
    const browser = await puppeteer.launch()
    const page = await browser.newPage()
    const htmlTemplate = await this.template.render(
      'User',
      'pdf',
      'pdf_template',
      data
    )
    await page.setContent(htmlTemplate, {
      waitUntil: ['domcontentloaded', 'networkidle2'],
    })
    await page.waitFor('*')
    const pdfBuffer = await page.pdf(pdfOptions)
    await browser.close()

    return pdfBuffer
  }

  /*
    return - {
      url : String : Location of where the S3 file lives
    }
  */
  async createPdf(ctx, options) {
    const f = `${this.f}::createPdf :>>`
    this.log.debug(f, { options })

    const { bucket, key, data } = options
    const pdfBuffer = await this._getPdfBuffer(data)
    const s3Params = {
      Body: pdfBuffer,
      Bucket: bucket,
      Key: key,
      ContentEncoding: 'buffer',
      ContentType: 'application/pdf',
      ACL: 'public-read',
    }

    return await this.s3.upload(s3Params)
  }
}

PDF.initClass()
exports.PDF = PDF
