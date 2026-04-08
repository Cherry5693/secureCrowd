const { v2: cloudinary } = require('cloudinary')

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
})

/**
 * Upload a base64 data URL (or any base64 string) to Cloudinary.
 * Returns the secure CDN URL on success, or throws on failure.
 *
 * @param {string} base64DataUrl  e.g. "data:image/png;base64,iVBOR..."
 * @param {object} opts           optional upload options
 * @returns {Promise<string>}     secure Cloudinary URL
 */
const uploadImage = (base64DataUrl, opts = {}) => {
  return new Promise((resolve, reject) => {
    const options = {
      folder:         'securecrowd',
      resource_type:  'auto',
      transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      ...opts,
    }

    // Use upload_stream for efficiency even with base64 inputs
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(new Error(`Cloudinary upload failed: ${err.message}`))
      resolve(result.secure_url)
    })

    // base64DataUrl may include "data:image/png;base64," prefix — strip it for the stream
    const base64Data = base64DataUrl.includes(',')
      ? base64DataUrl.split(',')[1]
      : base64DataUrl

    const buffer = Buffer.from(base64Data, 'base64')
    stream.end(buffer)
  })
}

module.exports = { uploadImage }
