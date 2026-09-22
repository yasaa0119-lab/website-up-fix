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
    console.log("Payload Webhook Pakasir diterima:", JSON.stringify(data));

    // Menangkap ID pesanan dan status dari berbagai variasi payload Pakasir v2
    const orderId = data.order_id || data.external_id || data.trx_id;
    const status = (data.status || "").toLowerCase();
    const amount = data.amount || data.total || 0;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID tidak ditemukan dalam payload' });
    }

    // Jika status dari Pakasir menyatakan lunas / berhasil / completed / paid
    if (status === 'completed' || status === 'paid' || status === 'success' || status === 'berhasil') {
      const firebaseProjectId = "unit-produksi-smkyadika13";
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/pesanan/${orderId}?updateMask.fieldPaths=status`;

      // Payload untuk memperbarui field 'status' saja menjadi 'Lunas' di Firestore
      const firestorePayload = {
        fields: {
          status: { stringValue: "Lunas" }
        }
      };

      const fbResponse = await fetch(firestoreUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(firestorePayload)
      });

      const fbResult = await fbResponse.text();
      console.log("Respons update Firestore:", fbResult);
    }

    return res.status(200).json({ success: true, message: "Webhook sukses diproses" });

  } catch (err) {
    console.error("Webhook Error Keseluruhan:", err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};