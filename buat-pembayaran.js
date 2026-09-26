const admin = require('firebase-admin');

// 1. Inisialisasi Firebase Admin (Bypass security rules)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n'),
        })
    });
}
const db = admin.firestore();

module.exports = async function(req, res) {
  // Pengaturan CORS agar tidak diblokir browser
  res.setHeader('Access-Control-Allow-Credentials', true); //
  res.setHeader('Access-Control-Allow-Origin', '*'); //
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST'); //
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); //

  if (req.method === 'OPTIONS') { //
    return res.status(200).end(); //
  }

  try {
    const { idPesanan, total, nama, kelas, catatan, items } = req.body || {};
    
    // ==========================================
    // MASUKKAN KEMBALI DATA PAKASIR DI SINI:
    // ==========================================
    const PAKASIR_API_KEY = 'dM7z54vGvIom2hGRLUOFVZSUE8RyMvW0'; //[cite: 2]
    const PROJECT_SLUG = 'unitproduksi'; //[cite: 2]
    // ==========================================

    const PAKASIR_URL = `https://app.pakasir.com/api/v2/create-transaction/${PROJECT_SLUG}/${idPesanan}`; //[cite: 2]

    // Melakukan request ke server Pakasir[cite: 2]
    const response = await fetch(PAKASIR_URL, { //[cite: 2]
      method: 'POST', //[cite: 2]
      headers: { //[cite: 2]
        'Content-Type': 'application/json', //[cite: 2]
        'X-Api-Key': PAKASIR_API_KEY //[cite: 2]
      },
      body: JSON.stringify({ //[cite: 2]
        method: "payment_link", //[cite: 2]
        amount: Math.round(Number(total)) //[cite: 2]
      })
    });

    const result = await response.json(); //[cite: 2]
    
    // Jika Pakasir sukses membuat tagihan[cite: 2]
    if (result && result.payment_link) { //[cite: 2]
      
      const batch = db.batch(); 
      
      // Catat pesanan ke Firebase
      const orderRef = db.collection('pesanan').doc(idPesanan);
      batch.set(orderRef, {
          idPesanan, nama, kelas, catatan, items, total,
          status: "Menunggu Pembayaran",
          paymentUrl: result.payment_link, //[cite: 2]
          waktu: admin.firestore.FieldValue.serverTimestamp()
      });

      // Potong stok otomatis di Firebase
      if (items && items.length > 0) {
          items.forEach(barang => {
              const stokRef = db.collection('stok_produk').doc(String(barang.id));
              batch.update(stokRef, {
                  sisa: admin.firestore.FieldValue.increment(-barang.qty)
              });
          });
      }

      // Eksekusi potong stok dan simpan pesanan secara aman
      await batch.commit();

      return res.status(200).json({  //[cite: 2]
        success: true,  //[cite: 2]
        payment_url: result.payment_link  //[cite: 2]
      });
    }

    console.error("Error dari Pakasir:", result); //[cite: 2]
    return res.status(400).json({ success: false, message: 'Gagal membuat tagihan di Pakasir' }); //[cite: 2]

  } catch (err) { //[cite: 2]
    console.error("Server Error:", err); //[cite: 2]
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server Vercel' }); //[cite: 2]
  }
};