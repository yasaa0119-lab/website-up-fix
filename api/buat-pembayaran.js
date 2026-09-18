// /api/buat-pembayaran.js
// Vercel Serverless Function — membuat transaksi QRIS via Duitku dari SERVER.
//
// KENAPA HARUS DI SINI (bukan di browser):
// Duitku memblokir (CORS) permintaan langsung dari browser ke API mereka, karena
// MerchantCode + ApiKey adalah kredensial rahasia yang tidak boleh terlihat pelanggan.
// File ini berjalan di server Vercel, jadi aman.
//
// WAJIB diisi di Vercel: Project Settings > Environment Variables
//   DUITKU_MERCHANT_CODE   -> kode merchant dari akun Duitku sandbox kamu
//   DUITKU_API_KEY         -> API key dari akun Duitku sandbox kamu
//   DUITKU_CALLBACK_URL    -> contoh: https://unitproduksismkyadika13.my.id/api/duitku-callback
//   DUITKU_RETURN_URL      -> contoh: https://unitproduksismkyadika13.my.id
// Setelah diisi, WAJIB redeploy (env var baru tidak otomatis kepakai di deployment lama).

import crypto from 'crypto';

// Sandbox. Kalau nanti sudah live, ganti ke:
// https://passport.duitku.com/webapi/api/merchant/v2/inquiry
const DUITKU_URL = 'https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { idPesanan, total, nama, kelas, catatan, items } = req.body || {};

    if (!idPesanan || !total || !nama) {
      return res.status(400).json({ success: false, message: 'Data pesanan tidak lengkap' });
    }

    const merchantCode = process.env.DUITKU_MERCHANT_CODE;
    const apiKey = process.env.DUITKU_API_KEY;

    if (!merchantCode || !apiKey) {
      console.error('DUITKU_MERCHANT_CODE / DUITKU_API_KEY belum diset di Environment Variables Vercel');
      return res.status(500).json({ success: false, message: 'Konfigurasi server pembayaran belum lengkap' });
    }

    const paymentAmount = Math.round(Number(total));
    const merchantOrderId = String(idPesanan);

    // WAJIB dihitung di server. Formula resmi Duitku:
    // MD5(merchantCode + merchantOrderId + paymentAmount + apiKey)
    const signature = crypto
      .createHash('md5')
      .update(merchantCode + merchantOrderId + paymentAmount + apiKey)
      .digest('hex');

    const itemDetails = (items || []).map((i) => ({
      name: i.name,
      price: Math.round(Number(i.price)),
      quantity: i.qty,
    }));

    const payload = {
      merchantCode,
      paymentAmount,
      paymentMethod: 'SP', // SP = QRIS (jalur ShopeePay QRIS di Duitku, ini kode standar untuk QRIS umum)
      merchantOrderId,
      productDetails: `Pesanan Unit Produksi SMK Yadika 13 - ${nama} (${kelas})`,
      additionalParam: catatan || '',
      customerVaName: nama,
      email: 'noreply@unitproduksismkyadika13.my.id',
      phoneNumber: '081200000000',
      itemDetails,
      customerDetail: {
        firstName: nama,
        lastName: '',
        email: 'noreply@unitproduksismkyadika13.my.id',
        phoneNumber: '081200000000',
      },
      callbackUrl: process.env.DUITKU_CALLBACK_URL,
      returnUrl: process.env.DUITKU_RETURN_URL,
      signature,
      expiryPeriod: 60, // menit
    };

    const duitkuRes = await fetch(DUITKU_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await duitkuRes.json();

    if (result.statusCode === '00') {
      return res.status(200).json({
        success: true,
        payment_url: result.paymentUrl,
        qr_string: result.qrString,
        reference: result.reference,
      });
    }

    console.error('Duitku menolak transaksi:', result);
    return res.status(200).json({
      success: false,
      message: result.statusMessage || result.Message || 'Gagal membuat transaksi Duitku',
    });
  } catch (err) {
    console.error('Server error saat membuat transaksi:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
}
