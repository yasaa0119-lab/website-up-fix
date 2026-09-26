module.exports = async function(req, res) {
  // Pengaturan CORS agar tidak diblokir browser
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Import firebase-admin secara dinamis untuk menghindari gagal load modul
    const admin = await import('firebase-admin');

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

    const { idPesanan, total, nama, kelas, catatan, items } = req.body || {};
    
    const PAKASIR_API_KEY = 'dM7z54vGvIom2hGRLUOFVZSUE8RyMvW0';
    const PROJECT_SLUG = 'unitproduksi';

    const PAKASIR_URL = `https://app.pakasir.com/api/v2/create-transaction/${PROJECT_SLUG}/${idPesanan}`;

    const response = await fetch(PAKASIR_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': PAKASIR_API_KEY
      },
      body: JSON.stringify({
        method: "payment_link",
        amount: Math.round(Number(total))
      })
    });

    const result = await response.json();
    
    if (result && result.payment_link) {
      const batch = db.batch(); 
      
      const orderRef = db.collection('pesanan').doc(idPesanan);
      batch.set(orderRef, {
          idPesanan, nama, kelas, catatan, items, total,
          status: "Menunggu Pembayaran",
          paymentUrl: result.payment_link,
          waktu: admin.firestore.FieldValue.serverTimestamp()
      });

      if (items && items.length > 0) {
          items.forEach(barang => {
              const stokRef = db.collection('stok_produk').doc(String(barang.id));
              batch.update(stokRef, {
                  sisa: admin.firestore.FieldValue.increment(-barang.qty)
              });
          });
      }

      await batch.commit();

      return res.status(200).json({
        success: true,
        payment_link: result.payment_link
      });
    }

    console.error("Error dari Pakasir:", result);
    return res.status(400).json({ success: false, message: 'Gagal membuat tagihan di Pakasir' });

  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server Vercel: ' + err.message });
  }
};