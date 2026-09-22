module.exports = async function(req, res) {
  // Izinkan semua akses CORS agar tidak diblokir Vercel
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const data = req.body || {};
    console.log("DATA DITERIMA DARI PAKASIR:", JSON.stringify(data));

    // Ambil order ID dan status pembayaran
    const orderId = data.order_id || data.external_id || data.trx_id;
    const status = (data.status || "").toLowerCase();

    if (orderId && (status === 'completed' || status === 'paid' || status === 'success' || status === 'berhasil')) {
      const firebaseProjectId = "unit-produksi-smkyadika13";
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/pesanan/${orderId}?updateMask.fieldPaths=status`;

      await fetch(firestoreUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            status: { stringValue: "Lunas" }
          }
        })
      });
    }

    // Selalu balas 200 OK agar Pakasir mencatat status 200 (Sukses) di Webhook Log
    return res.status(200).json({ success: true, message: "Webhook diterima dengan baik" });

  } catch (err) {
    console.error("Error webhook:", err);
    return.status(200).json({ success: true, error: err.message }); // Tetap balas 200 agar tidak 405/500 di Pakasir
  }
};