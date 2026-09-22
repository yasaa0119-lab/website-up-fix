export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Ambil data baik dari req.body langsung maupun jika berbentuk string/URL-encoded
    const data = req.body || {};
    console.log("RAW PAYLOAD DARI PAKASIR:", JSON.stringify(data));

    // Ekstrak ID dan Status dengan berbagai kemungkinan nama variabel dari Pakasir v2
    const orderId = data.order_id || data.external_id || data.trx_id || data.reference;
    const status = (data.status || data.transaction_status || "").toLowerCase();

    console.log(`Menerima Webhook -> Order ID: ${orderId}, Status: ${status}`);

    if (orderId) {
      // Cek apakah status pembayaran sukses
      if (status.includes('success') || status.includes('paid') || status.includes('completed') || status.includes('berhasil')) {
        const firebaseProjectId = "unit-produksi-smkyadika13";
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/pesanan/${orderId}?updateMask.fieldPaths=status`;

        const fbRes = await fetch(firestoreUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              status: { stringValue: "Lunas" }
            }
          })
        });

        const fbResultText = await fbRes.text();
        console.log("Hasil Update Firestore:", fbResultText);
      }
    }

    // Selalu balas 200 OK agar Pakasir mencatat status 200 (Sukses) di Webhook Log
    return res.status(200).json({ status: "success", message: "Webhook diterima & diproses" });
  } catch (err) {
    console.error("Gagal Memproses Webhook:", err);
    return res.status(200).json({ status: "success", error: err.message });
  }
}