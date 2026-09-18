import crypto from 'crypto';

const DOKU_URL = 'https://api-sandbox.doku.com/checkout/v1/payment';
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

function timestampDoku() {
  return new Date().toISOString().split('.')[0] + 'Z';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { idPesanan, total, nama, kelas, catatan, items } = req.body || {};

    const clientId = process.env.DOKU_CLIENT_ID;
    const secretKey = process.env.DOKU_SECRET_KEY;

    if (!clientId || !secretKey) {
      console.error('DOKU_CLIENT_ID / DOKU_SECRET_KEY belum diset di Environment Variables Vercel');
      return res.status(500).json({ success: false, message: 'Konfigurasi server pembayaran belum lengkap' });
    }

    const paymentAmount = Math.round(Number(total));
    const invoiceNumber = String(idPesanan);

    const lineItems = (items || []).map((i) => ({
      name: i.name,
      price: Math.round(Number(i.price)),
      quantity: i.qty,
    }));

    const body = {
      order: {
        invoice_number: invoiceNumber,
        amount: paymentAmount,
        currency: 'IDR',
        line_items: lineItems,
        callback_url: process.env.DOKU_CALLBACK_URL,
        callback_url_cancel: process.env.DOKU_CALLBACK_URL_CANCEL || process.env.DOKU_CALLBACK_URL,
        auto_redirect: true,
      },
      payment: {
        payment_due_date: 60, // menit
      },
      customer: {
        name: nama,
        email: 'noreply@unitproduksismkyadika13.my.id',
        phone: '081200000000',
        address: catatan || '-',
        country: 'ID',
      },
    };

    const rawBody = JSON.stringify(body);
    const requestId = crypto.randomUUID();
    const timestamp = timestampDoku();
    const digest = buatDigest(rawBody);
    const signature = buatSignature({
      clientId,
      requestId,
      timestamp,
      requestTarget: DOKU_REQUEST_TARGET,
      digest,
      secretKey,
    });

    const dokuRes = await fetch(DOKU_URL, {
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

    const result = await dokuRes.json();

    if (dokuRes.ok && result?.response?.payment?.url) {
      return res.status(200).json({
        success: true,
        payment_url: result.response.payment.url,
        token_id: result.response.payment.token_id,
        expired_date: result.response.payment.expired_date,
      });
    }

    console.error('DOKU menolak transaksi:', result);
    return res.status(200).json({
      success: false,
      message: (result?.message && result.message.join(', ')) || 'Gagal membuat tagihan DOKU',
    });
  } catch (err) {
    console.error('Server error saat membuat transaksi:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
}