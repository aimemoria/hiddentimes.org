// Where uploaded images are kept: online (S3-compatible) when S3_* is set, otherwise the local uploads/ folder.
//
// S3-compatible services that work: Cloudflare R2, AWS S3, Supabase Storage, Backblaze B2, DigitalOcean Spaces, MinIO.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

// covers/2026/11/<random>.jpg
const makeKey = (ext) => {
  const d = new Date();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `covers/${d.getUTCFullYear()}/${mm}/${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}${ext}`;
};

function createLocalMedia(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const fileFor = (key) => {
    const full = path.resolve(dir, key);
    if (!full.startsWith(path.resolve(dir) + path.sep)) throw new Error('Bad media key');
    return full;
  };
  return {
    kind: 'local folder',
    urlFor: (key) => '/uploads/' + key,
    async put({ buffer, ext, contentType }) {
      const key = makeKey(ext);
      const file = fileFor(key);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      await fs.promises.writeFile(file, buffer);
      return { key, url: '/uploads/' + key, contentType, size: buffer.length };
    },
    async remove(key) {
      if (!key) return;
      await fs.promises.unlink(fileFor(key)).catch(() => {});
    },
  };
}

function createS3Media(s3conf) {
  const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
  const client = new S3Client({
    region: s3conf.region,
    ...(s3conf.endpoint ? { endpoint: s3conf.endpoint } : {}),
    forcePathStyle: s3conf.forcePathStyle,
    credentials: { accessKeyId: s3conf.accessKeyId, secretAccessKey: s3conf.secretAccessKey },
  });
  if (!s3conf.publicUrl) {
    throw new Error('S3_PUBLIC_URL is required: the public address your bucket serves images from.');
  }
  const urlFor = (key) => `${s3conf.publicUrl}/${key}`;
  return {
    kind: `online storage (${s3conf.bucket})`,
    urlFor,
    async put({ buffer, ext, contentType }) {
      const key = makeKey(ext);
      await client.send(new PutObjectCommand({
        Bucket: s3conf.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable', // file names never change, so cache forever
      }));
      return { key, url: urlFor(key), contentType, size: buffer.length };
    },
    async remove(key) {
      if (!key) return;
      await client.send(new DeleteObjectCommand({ Bucket: s3conf.bucket, Key: key })).catch((e) => {
        console.warn('Could not delete image from storage:', key, e.message);
      });
    },
  };
}

const createMedia = () => (config.useS3 ? createS3Media(config.S3) : createLocalMedia(config.LOCAL_UPLOADS_DIR));

module.exports = { createMedia, createLocalMedia, createS3Media };
