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
  // Pengaturan CORS agar tidak diblokir browser[cite: 10]
  res.setHeader('Access-Control-Allow-Credentials', true); //[cite: 10]
  res.setHeader('Access-Control-Allow-Origin', '*'); //[cite: 10]
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST'); //[cite: 10]
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); //[cite: 10]

  if (req.method === 'OPTIONS') { //[cite: 10]
    return res.status(200).end(); //[cite: 10]
  }

  try {
    // Ambil SEMUA data dari frontend (keranjang, nama, dll)[cite: 10]
    const { idPesanan, total, nama, kelas, catatan, items } = req.body || {};
    
    const PAKASIR_API_KEY = 'dM7z54vGvIom2hGRLUOFVZSUE8RyMvW0'; //[cite: 10]
    const PROJECT_SLUG = 'unitproduksi'; //[cite: 10]
    const PAKASIR_URL = `https://app.pakasir.com/api/v2/create-transaction/${PROJECT_SLUG}/${idPesanan}`; //[cite: 10]

    // Melakukan request ke server Pakasir[cite: 10]
    const response = await fetch(PAKASIR_URL, { //[cite: 10]
      method: 'POST', //[cite: 10]
      headers: { //[cite: 10]
        'Content-Type': 'application/json', //[cite: 10]
        'X-Api-Key': PAKASIR_API_KEY //[cite: 10]
      },
      body: JSON.stringify({ //[cite: 10]
        method: "payment_link", //[cite: 10]
        amount: Math.round(Number(total)) //[cite: 10]
      })
    });

    const result = await response.json(); //[cite: 10]
    
    // Jika Pakasir sukses membuat tagihan[cite: 10]
    if (result && result.payment_link) { //[cite: 10]
      
      const batch = db.batch(); 
      
      // Catat pesanan ke Firebase
      const orderRef = db.collection('pesanan').doc(idPesanan);
      batch.set(orderRef, {
          idPesanan, nama, kelas, catatan, items, total,
          status: "Menunggu Pembayaran",
          paymentUrl: result.payment_link, //[cite: 10]
          waktu: admin.firestore.FieldValue.serverTimestamp()
      });

      // Potong stok di Firebase
      if (items && items.length > 0) {
          items.forEach(barang => {
              const stokRef = db.collection('stok_produk').doc(String(barang.id));
              batch.update(stokRef, {
                  sisa: admin.firestore.FieldValue.increment(-barang.qty)
              });
          });
      }

      // Eksekusi potong stok dan simpan pesanan
      await batch.commit();

      return res.status(200).json({  //[cite: 10]
        success: true,  //[cite: 10]
        payment_url: result.payment_link  //[cite: 10]
      });
    }

    console.error("Error dari Pakasir:", result); //[cite: 10]
    return res.status(400).json({ success: false, message: 'Gagal membuat tagihan di Pakasir' }); //[cite: 10]

  } catch (err) { //[cite: 10]
    console.error("Server Error:", err); //[cite: 10]
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server Vercel' }); //[cite: 10]
  }
};