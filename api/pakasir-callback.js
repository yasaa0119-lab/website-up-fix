module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const data = req.body || {};
    console.log("Webhook Pakasir diterima:", data);

    // Menangkap parameter dari Pakasir v2
    const orderId = data.order_id || data.external_id;
    const status = data.status;
    const amount = data.amount || data.total;

    // Cek apakah status pembayaran dari Pakasir menyatakan sukses/lunas
    if (status === 'completed' || status === 'paid' || status === 'Success' || status === 'berhasil') {
      const firebaseProjectId = "unit-produksi-smkyadika13";
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/pesanan/${orderId}`;

      const firestorePayload = {
        fields: {
          id: { stringValue: String(orderId || "UP-DEFAULT") },
          status: { stringValue: "Lunas" },
          total: { integerValue: Number(amount || 0) }
        }
      };

      // Mengirim pembaruan status ke Firebase Firestore
      await fetch(firestoreUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(firestorePayload)
      });
      
      console.log(`Pesanan ${orderId} berhasil diperbarui menjadi Lunas.`);
    }

    return res.status(200).json({ success: true, message: "Webhook berhasil diproses" });

  } catch (err) {
    console.error("Webhook Error:", err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};