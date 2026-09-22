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

    // Pakasir v2 mengirimkan informasi seperti order_id, status, amount, dll.
    const { order_id, status, amount } = data;

    // Jika pembayaran sukses/completed, kita kirim data ke Firebase Firestore via REST API
    if (status === 'completed' || status === 'paid' || status === 'Success') {
      const firebaseProjectId = "unit-produksi-smkyadika13";
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/pesanan/${order_id}`;

      // Format payload untuk Firebase Firestore REST API
      const firestorePayload = {
        fields: {
          id: { stringValue: String(order_id || "UP-DEFAULT") },
          status: { stringValue: "Lunas" },
          total: { integerValue: Number(amount || 0) },
          dibuat: { timestampValue: new Date().toISOString() }
        }
      };

      // Kirim update/create ke Firestore
      await fetch(firestoreUrl, {
        method: 'PATCH', // PATCH akan membuat atau memperbarui dokumen berdasarkan ID
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(firestorePayload)
      });
      
      console.log(`Pesanan ${order_id} berhasil diupdate menjadi Lunas di Firebase.`);
    }

    return res.status(200).json({ success: true, message: "Webhook processed successfully" });

  } catch (err) {
    console.error("Webhook Error:", err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};