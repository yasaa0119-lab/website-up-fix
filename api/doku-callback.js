// /api/doku-callback.js
import crypto from 'crypto';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

export const config = {
  api: { bodyParser: false },
};

function bacaRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function buatDigest(rawBody) {
  return crypto.createHash('sha256').update(rawBody).digest('base64');
}

function buatSignature({ clientId, requestId, timestamp, requestTarget, digest, secretKey }) {
  const komponen =
    `Client-Id:${clientId}\n` +
    `Request-Id:${requestId}\n` +
    `Request-Timestamp:${timestamp}\n` +
    `Request-Target:${requestTarget}\n` +
    `Digest:${digest}`;

  const hmac = crypto.createHmac('sha256', secretKey).update(komponen).digest('base64');
  return `HMACSHA256=${hmac}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const secretKey = process.env.DOKU_SECRET_KEY;
  if (!secretKey) {
    console.error('DOKU_SECRET_KEY belum diset di Environment Variables Vercel');
    return res.status(500).send('Server misconfigured');
  }

  const clientId = req.headers['client-id'];
  const requestId = req.headers['request-id'];
  const timestamp = req.headers['request-timestamp'];
  const signatureHeader = req.headers['signature'];

  if (!clientId || !requestId || !timestamp || !signatureHeader) {
    return res.status(400).send('Bad Parameter');
  }

  const rawBody = await bacaRawBody(req);

  const digest = buatDigest(rawBody);
  const signatureHitung = buatSignature({
    clientId,
    requestId,
    timestamp,
    requestTarget: '/api/doku-callback',
    digest,
    secretKey,
  });

  if (signatureHitung !== signatureHeader) {
    console.error('Callback ditolak: signature tidak cocok');
    return res.status(401).send('Bad Signature');
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch (e) {
    return res.status(400).send('Bad JSON');
  }

  const invoiceNumber = body?.order?.invoice_number;
  const status = body?.transaction?.status;

  if (!invoiceNumber) {
    return res.status(400).send('Missing invoice_number');
  }

  try {
    if (status === 'SUCCESS') {
      await db.collection('pesanan').doc(invoiceNumber).update({ status: 'Lunas' });
    }
    return res.status(200).send('OK');
  } catch (err) {
    console.error('Gagal update Firestore:', err);
    return res.status(500).send('Error updating order');
  }
}