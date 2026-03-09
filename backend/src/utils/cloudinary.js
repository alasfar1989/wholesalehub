const cloudinary = require('cloudinary').v2;

// CLOUDINARY_URL env var auto-configures (cloudinary://key:secret@cloud_name)
cloudinary.config();

async function uploadImage(buffer, folder = 'wholesalehub/listings') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', quality: 'auto', fetch_format: 'auto' },
      (err, result) => {
        if (err) reject(err);
        else resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

async function deleteImage(publicId) {
  return cloudinary.uploader.destroy(publicId);
}

module.exports = { uploadImage, deleteImage };
