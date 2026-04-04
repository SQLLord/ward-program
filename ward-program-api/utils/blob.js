// utils/blob.js
// ─────────────────────────────────────────────────────────────────────────────
// Azure Blob Storage utility — uses Managed Identity in production,
// connection string in local dev (set AZURE_STORAGE_CONNECTION_STRING in .env)
// ─────────────────────────────────────────────────────────────────────────────
const { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');

const CONTAINER_NAME = 'ward-images';
const ACCOUNT_NAME   = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const CONN_STRING    = process.env.AZURE_STORAGE_CONNECTION_STRING; // local dev only
const isDev = process.env.NODE_ENV !== 'production';

let _blobServiceClient = null;
let _containerClient   = null;

// ── Build the BlobServiceClient ───────────────────────────────────────────────

function getBlobServiceClient() {
  if (_blobServiceClient) return _blobServiceClient; // ← return cached instance

  if (!isDev) {
    if (!ACCOUNT_NAME) throw new Error('[Blob] AZURE_STORAGE_ACCOUNT_NAME is required in production.');
    const url = `https://${ACCOUNT_NAME}.blob.core.windows.net`;
    _blobServiceClient = new BlobServiceClient(url, new DefaultAzureCredential());
  } else {
    if (!CONN_STRING) throw new Error('[Blob] AZURE_STORAGE_CONNECTION_STRING is required for local dev.');
    _blobServiceClient = BlobServiceClient.fromConnectionString(CONN_STRING);
  }

  return _blobServiceClient;
}


// ── Get a reference to the ward-images container ──────────────────────────────

function getContainer() {
  if (!_containerClient) {                                        // ← null check
    _containerClient = getBlobServiceClient()                     // ← lazy-init via proper function
      .getContainerClient(CONTAINER_NAME);
  }
  return _containerClient;                                        // ← return cached instance
}


// ─────────────────────────────────────────────────────────────────────────────
// Uploads an image buffer to blob storage.
// uploadImageBuffer(buffer, mimeType, folder)
// Returns the blob name (stored in DB as cover_image_blob_name in WardImages).
// ─────────────────────────────────────────────────────────────────────────────
async function uploadImageBuffer(buffer, mimeType, folder = 'library') {
  // ── Validate mime type ────────────────────────────────────────────────────
  const ALLOWED_TYPES = {
    'image/jpeg': 'jpg',
    'image/png':  'png',
    'image/gif':  'gif',
    'image/webp': 'webp',
  };
  const ext = ALLOWED_TYPES[mimeType];
  if (!ext) throw new Error(`Unsupported image type: ${mimeType}`);

  // ── Generate a unique blob name ───────────────────────────────────────────
  // Format: programs/{programId}/{timestamp}.{ext}
  // Keeps images organized per program and avoids collisions
  const blobName = `${folder}/${Date.now()}.${ext}`;

  const container = getContainer();
  const blockBlob = container.getBlockBlobClient(blobName);

  await blockBlob.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: mimeType,
      blobCacheControl: 'public, max-age=31536000', // ← 1 year — images are immutable
    },
  });

  if (isDev) console.log(`[Blob] ✅ Uploaded: ${blobName}`);
  return blobName; // ← stored in DB, used to generate SAS URLs later
}

// ─────────────────────────────────────────────────────────────────────────────
// generateSasUrl(blobName, expiryMinutes)
// Generates a short-lived SAS URL for a private blob.
// Used by PDFGenerator and ProgramHome image display.
// ─────────────────────────────────────────────────────────────────────────────
async function generateSasUrl(blobName, expiryMinutes = 480) {
  if (!blobName) return null;

  if (!isDev) {
    // ── Production: User Delegation SAS (Managed Identity — no storage keys) ─
    const serviceClient = getBlobServiceClient();
    
    const startsOn  = new Date(Date.now() - 5 * 60 * 1000);
    const expiresOn = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // User delegation key — valid for up to 7 days, cached by the SDK
    const delegationKey = await serviceClient.getUserDelegationKey(startsOn, expiresOn);

    const sasToken = generateBlobSASQueryParameters(
      {
        containerName:  CONTAINER_NAME,
        blobName,
        permissions:    BlobSASPermissions.parse('r'), // ← read only
        startsOn,
        expiresOn,
      },
      delegationKey,
      ACCOUNT_NAME
    ).toString();

    return `https://${ACCOUNT_NAME}.blob.core.windows.net/${CONTAINER_NAME}/${blobName}?${sasToken}`;
  }

  // ── Local dev: Account Key SAS (from connection string) ───────────────────
  // Parse account name + key from connection string
  const accountNameMatch = CONN_STRING.match(/AccountName=([^;]+)/);
  const accountKeyMatch  = CONN_STRING.match(/AccountKey=([^;]+)/);
  if (!accountNameMatch || !accountKeyMatch) {
    throw new Error('[Blob] Could not parse AccountName/AccountKey from connection string.');
  }
  const localAccountName = accountNameMatch[1];
  const localAccountKey  = accountKeyMatch[1];

  const sharedKeyCredential = new StorageSharedKeyCredential(localAccountName, localAccountKey);
  
  const startsOn  = new Date(Date.now() - 5 * 60 * 1000);
  const expiresOn = new Date(Date.now() + expiryMinutes * 60 * 1000);


  const sasToken = generateBlobSASQueryParameters(
    {
      containerName:  CONTAINER_NAME,
      blobName,
      permissions:    BlobSASPermissions.parse('r'),
      startsOn,
      expiresOn,
    },
    sharedKeyCredential
  ).toString();

  return `https://${localAccountName}.blob.core.windows.net/${CONTAINER_NAME}/${blobName}?${sasToken}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// deleteBlob(blobName)
// Deletes a blob — called when a program image is replaced or program deleted.
// Silently succeeds if blob doesn't exist.
// ─────────────────────────────────────────────────────────────────────────────
async function deleteBlob(blobName) {
  if (!blobName) return;
  try {
    const container = getContainer();
    await container.getBlockBlobClient(blobName).deleteIfExists();
    if (isDev) console.log(`[Blob] 🗑️ Deleted: ${blobName}`);
  } catch (err) {
    // Non-fatal — log and continue
    console.warn(`[Blob] ⚠️ Could not delete blob ${blobName}:`, err.message);
  }
}

module.exports = { uploadImageBuffer, generateSasUrl, deleteBlob, getContainer };