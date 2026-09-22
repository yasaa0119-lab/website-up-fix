module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const data = req.body || {};
    console.log("LOG WEBHOOK PAKASIR:", JSON.stringify(data));

    // Simpan mentah-mentah data webhook ke Firestore di koleksi 'webhook_logs' 
    // agar kita bisa lihat apa yang dikirim Pakasir lewat Firebase Console
    const firebaseProjectId = "unit-produksi-smkyadika13";
    const logUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/webhook_logs`;

    await fetch(logUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          payload: { stringValue: JSON.stringify(data) },
          waktu: { timestampValue: new Date().toISOString() }
        }
      })
    });

    // Cari order ID dari berbagai kemungkinan nama field
    const orderId = data.order_id || data.external_id || data.trx_id || data.reference;
    const status = (data.status || "").toLowerCase();

    if (orderId && (status === 'completed' || status === 'paid' || status === 'success' || status === 'berhasil')) {
      const updateUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/pesanan/${orderId}?updateMask.fieldPaths=status`;
      
      await fetch(updateUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            status: { stringValue: "Lunas" }
          }
        })
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};