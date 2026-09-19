import crypto from 'crypto';
import admin from 'firebase-admin';

// Inisialisasi Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (e) {
    console.error("Gagal inisialisasi Firebase:", e);
  }
}

const db = admin.apps.length ? admin.firestore() : null;

const DOKU_URL = 'https://api.doku.com/checkout/v1/payment';
const DOKU_REQUEST_TARGET = '/checkout/v1/payment';

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
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { idPesanan, total, nama, catatan, items } = req.body || {};
    
    // Kunci DOKU Live langsung di-hardcode agar stabil
    const clientId = 'BRN-0243-1788663032393';
    const secretKey = 'SK-QsyHcfr32V860Emcub52'; // Ganti dengan Secret Key lengkapmu dari dashboard DOKU

    if (!clientId || !secretKey) {
      return res.status(500).json({ success: false, message: 'Konfigurasi server belum lengkap' });
    }

    const body = {
      order: {
        invoice_number: String(idPesanan),
        amount: Math.round(Number(total)),
        currency: 'IDR',
        line_items: (items || []).map(i => ({ name: i.name, price: Math.round(Number(i.price)), quantity: i.qty })),
        callback_url: "https://unitproduksismkyadika13.my.id",
        auto_redirect: true,
      },
      payment: { payment_due_date: 60 },
      customer: { name: nama, email: 'noreply@unitproduksismkyadika13.my.id', phone: '081200000000', address: catatan || '-', country: 'ID' }
    };

    const rawBody = JSON.stringify(body);
    const requestId = crypto.randomUUID();
    const timestamp = new Date().toISOString().split('.')[0] + 'Z';
    const digest = buatDigest(rawBody);
    const signature = buatSignature({ clientId, requestId, timestamp, requestTarget: DOKU_REQUEST_TARGET, digest, secretKey });

    const dokuRes = await fetch(DOKU_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': clientId,
        'Request-Id': requestId,
        'Request-Timestamp': timestamp,
        'Signature': signature,
      },
      body: rawBody,
    });

    const result = await dokuRes.json();
    if (dokuRes.ok && result?.response?.payment?.url) {
      // Simpan riwayat pesanan ke Firestore jika database aktif
      if (db) {
        try {
          await db.collection('pesanan').doc(String(idPesanan)).set({
            idPesanan,
            total,
            nama,
            catatan,
            items,
            status: 'PENDING',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        } catch (dbErr) {
          console.error("Gagal simpan ke Firestore:", dbErr);
        }
      }

      return res.status(200).json({ success: true, payment_url: result.response.payment.url });
    }

    console.error("DOKU Error Response:", result);
    return res.status(400).json({ success: false, message: 'Gagal membuat tagihan DOKU' });
  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
}