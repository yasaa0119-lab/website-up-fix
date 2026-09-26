module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { idPesanan, total, nama, kelas, catatan, items } = req.body || {};
    
    const PAKASIR_API_KEY = 'dM7z54vGvIom2hGRLUOFVZSUE8RyMvW0';
    const PROJECT_SLUG = 'unitproduksi';

    // Buat transaksi ke Pakasir
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
      // Simpan pesanan ke Firestore via REST API (Aman di backend, tanpa modul ribet)
      const projectId = process.env.FIREBASE_PROJECT_ID;
      if (projectId) {
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/pesanan/${idPesanan}`;
        
        await fetch(firestoreUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              idPesanan: { stringValue: String(idPesanan) },
              nama: { stringValue: String(nama || '') },
              kelas: { stringValue: String(kelas || '') },
              catatan: { stringValue: String(catatan || '') },
              total: { doubleValue: Number(total) },
              status: { stringValue: "Menunggu Pembayaran" },
              paymentUrl: { stringValue: String(result.payment_link) }
            }
          })
        });
      }

      return res.status(200).json({
        success: true,
        payment_url: result.payment_link
      });
    }

    return res.status(400).json({ success: false, message: 'Gagal membuat tagihan di Pakasir' });

  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};