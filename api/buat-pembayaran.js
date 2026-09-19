const crypto = require('crypto');

// Production: https://api.doku.com | Sandbox: https://api-sandbox.doku.com
// Set DOKU_BASE_URL di Vercel kalau ingin ganti environment. Default: Production.
const DOKU_BASE_URL = process.env.DOKU_BASE_URL || 'https://api.doku.com';
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

// DOKU menolak karakter aneh di beberapa field -> bersihkan dulu
const bersih = (s, fallback) =>
  String(s || '').replace(/[^a-zA-Z0-9 .\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) || fallback;

module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://unitproduksismkyadika13.my.id');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { idPesanan, nama, catatan, items } = req.body || {};

    // WAJIB dari Environment Variables Vercel, jangan di-hardcode
    const clientId = process.env.DOKU_CLIENT_ID; 
    const secretKey = process.env.DOKU_SECRET_KEY;
    if (!clientId || !secretKey) {
      return res.status(500).json({ success: false, message: 'Konfigurasi server belum lengkap' });
    }

    if (!idPesanan || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Data pesanan tidak valid' });
    }

    const lineItems = items.map((i) => ({
      name: bersih(i.name, 'Produk'),
      price: Math.round(Number(i.price)),
      quantity: Math.round(Number(i.qty)),
    }));

    if (lineItems.some((i) => !(i.price > 0) || !(i.quantity > 0))) {
      return res.status(400).json({ success: false, message: 'Harga/jumlah item tidak valid' });
    }

    // amount HARUS sama dengan jumlah price x quantity semua line item
    const amount = lineItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const body = {
      order: {
        invoice_number: String(idPesanan).replace(/[^a-zA-Z0-9_\-]/g, ''),
        amount,
        currency: 'IDR',
        line_items: lineItems,
        callback_url: 'https://unitproduksismkyadika13.my.id',
        auto_redirect: true,
      },
      payment: { payment_due_date: 60 },
      customer: {
        name: bersih(nama, 'Pelanggan'),
        email: 'noreply@unitproduksismkyadika13.my.id',
        phone: '081200000000',
        address: bersih(catatan, '-'),
        country: 'ID',
      },
    };

    const rawBody = JSON.stringify(body);
    const requestId = crypto.randomUUID();
    const timestamp = new Date().toISOString().split('.')[0] + 'Z';
    const digest = buatDigest(rawBody);
    const signature = buatSignature({
      clientId, requestId, timestamp,
      requestTarget: DOKU_REQUEST_TARGET, digest, secretKey,
    });

    const dokuRes = await fetch(DOKU_BASE_URL + DOKU_REQUEST_TARGET, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': clientId,
        'Request-Id': requestId,
        'Request-Timestamp': timestamp,
        Signature: signature,
      },
      body: rawBody,
    });

    const result = await dokuRes.json().catch(() => ({}));

    if (dokuRes.ok && result?.response?.payment?.url) {
      return res.status(200).json({ success: true, payment_url: result.response.payment.url });
    }

    // Log lengkap ke Vercel Logs supaya penyebab aslinya kelihatan
    console.error('DOKU HTTP status:', dokuRes.status);
    console.error('DOKU Error Response:', JSON.stringify(result));
    console.error('Request body dikirim:', rawBody);

    const pesanDoku = result?.error_messages?.join(', ') || result?.message?.join?.(', ') || result?.message || '';
    return res.status(400).json({
      success: false,
      message: `Gagal membuat tagihan DOKU (${dokuRes.status}) ${pesanDoku}`.trim(),
    });
  } catch (err) {
    console.error('Server Error:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};