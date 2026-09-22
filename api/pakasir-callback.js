// Menggunakan Firebase Admin SDK atau langsung mencatat via fetch/client jika diperlukan,
// atau kita tangkap data dari Pakasir v2.
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
    const notification = req.body || {};
    
    // Pakasir mengirim data seperti order_id, status (completed/paid), amount, dll.
    const { order_id, status, txn_id, amount } = notification;

    console.log("Notifikasi Webhook Pakasir diterima:", notification);

    // Di sini webhook menerima laporan sukses dari Pakasir.
    // Karena halaman admin kamu (ruangrahasiaup.html) menggunakan Firebase Client SDK,
    // pastikan status pesanan di database Firebase terupdate menjadi 'Lunas' ketika status dari Pakasir 'completed' atau 'paid'.

    return res.status(200).json({ success: true, message: "Webhook diterima" });

  } catch (err) {
    console.error("Webhook Error:", err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};