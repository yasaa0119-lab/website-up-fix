export default async function handler(req, res) {
  // Set header agar mendukung CORS dan semua metode
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Tangani preflight request OPTIONS dari browser/server luar
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Meskipun metode selain POST masuk, kita tetap balas 200 atau tangani agar tidak 405
  const data = req.body || {};
  console.log("PAYLOAD MASUK DARI PAKASIR:", JSON.stringify(data));

  try {
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
      console.log(`Pesanan ${orderId} berhasil diubah jadi Lunas secara otomatis.`);
    }
  } catch (err) {
    console.error("Gagal update database:", err);
  }

  // Wajib mengembalikan status 200 OK agar Pakasir mencatat log sukses (bukan 405)
  return res.status(200).json({ status: "success", message: "Webhook diterima" });
}