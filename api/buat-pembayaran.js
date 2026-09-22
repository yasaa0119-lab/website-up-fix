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
    const { idPesanan, total } = req.body || {};
    
    // ==========================================
    // BAGIAN YANG HARUS KAMU UBAH:
    // ==========================================
    // 1. Masukkan API Key dari menu "Proyek" di Pakasir
    const PAKASIR_API_KEY = 'dM7z54vGvIom2hGRLUOFVZSUE8RyMvW0'; 
    
    // 2. Slug proyek kamu (huruf kecil semua, tanpa spasi)
    const PROJECT_SLUG = 'unitproduksi'; 
    // ==========================================

    // Endpoint API Pakasir v2 sesuai dokumentasi
    const PAKASIR_URL = `https://app.pakasir.com/api/v2/create-transaction/${PROJECT_SLUG}/${idPesanan}`;

    // Melakukan request ke server Pakasir
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
    
    // Jika Pakasir sukses membuat tagihan, kembalikan URL pembayarannya ke index.html
    if (result && result.payment_link) {
      return res.status(200).json({ 
        success: true, 
        payment_url: result.payment_link 
      });
    }

    // Jika Pakasir menolak (error)
    console.error("Error dari Pakasir:", result);
    return res.status(400).json({ success: false, message: 'Gagal membuat tagihan di Pakasir' });

  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server Vercel' });
  }
};