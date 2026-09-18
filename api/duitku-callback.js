// /api/duitku-callback.js
// Dipanggil OTOMATIS oleh server Duitku (bukan oleh browser pelanggan) begitu
// pembayaran QRIS berhasil/gagal. Tugasnya: verifikasi bahwa request ini betul
// dari Duitku, lalu update status pesanan di Firestore supaya pantauStatusPesanan()
// di index.html langsung melihat perubahannya.
//
// TAMBAHAN Environment Variable yang dibutuhkan di Vercel:
//   FIREBASE_SERVICE_ACCOUNT -> isi dengan seluruh isi file JSON service account
//                                Firebase kamu (di-paste sebagai satu string JSON utuh)
//
// Cara dapat file service account:
// Firebase Console > Project Settings > Service Accounts > Generate New Private Key

import crypto from 'crypto';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const { merchantCode, amount, merchantOrderId, signature, resultCode } = req.body || {};
  const apiKey = process.env.DUITKU_API_KEY;

  if (!merchantCode || !amount || !merchantOrderId || !signature) {
    return res.status(400).send('Bad Parameter');
  }

  // Verifikasi keaslian callback. Formula: MD5(merchantCode + amount + merchantOrderId + apiKey)
  const calcSignature = crypto
    .createHash('md5')
    .update(merchantCode + amount + merchantOrderId + apiKey)
    .digest('hex');

  if (signature !== calcSignature) {
    console.error('Callback ditolak: signature tidak cocok');
    return res.status(401).send('Bad Signature');
  }

  try {
    await db.collection('pesanan').doc(merchantOrderId).update({
      status: resultCode === '00' ? 'Sudah Dibayar' : 'Pembayaran Gagal',
    });
    return res.status(200).send('OK');
  } catch (err) {
    console.error('Gagal update Firestore:', err);
    return res.status(500).send('Error updating order');
  }
}
