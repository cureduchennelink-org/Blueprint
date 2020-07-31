const Promise = require('bluebird')
const puppeteer = require('puppeteer')

class PDF {
  static initClass() {
    this.deps = { services: ['template'] }
  }

  constructor(kit) {
    this.module = `Blueprint`
    this.resource = `PDF`
    this.f = `${this.module}::${this.resource}`
    this.log = kit.services.logger.log
    this.E = kit.services.error
    this.template = kit.services.template
    this.config = kit.services.config
  }

  async wrapper(fn) {
    let res
    try {
      res = await fn()
    } catch (e) {
      return e
    }

    return res
  }

  async _createPdf(ctx, content) {
    f = `${this.f}::createPdf :>>`
    this.log.debug(f, { content })

    const send = { success: true }
    const options = { format: 'Letter' }
    const { recipient, details, sender } = content
    let page = false
    let browser = false

    browser = await puppeteer.launch()
    page = await browser.newPage()
    const htmlTemplate = this.template.render('User', 'pdf', 'pdf_template', {})
    await page.setContent(htmlTemplate, {
      waitUntil: ['domcontentloaded', 'networkidle2'],
    })
    await page.emulateMedia('screen')
    await page.waitFor('*')
    const pdfBuffer = await page.pdf(options)
    // @s3.s3UploadInvoice pdf_buffer, key

    send.url_location = result.url_location
    browser.close()
    return send
  }

  async createPdf(ctx, content) {
    const fn = () => this._createPdf(ctx, content)
    return await this.wrapper(fn)
  }
}

PDF.initClass()
exports.PDF = PDF
