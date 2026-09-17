const crypto = require('crypto');

exports.handler = async (event, context) => {
    // Hanya izinkan metode POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Metode tidak diizinkan' };
    }

    try {
        // 1. Menerima data pesanan dari frontend
        const data = JSON.parse(event.body);
        const { idPesanan, total, nama } = data;

        // ====================================================================
        // KREDENSIAL DUITKU (DAPATKAN DI DASHBOARD DUITKU -> INTEGRASI)
        // ====================================================================
        const MERCHANT_CODE = 'DS35495'; // Contoh: D12345
        const API_KEY = '282b322af7228e1f7260160b2a96a715'; // Contoh: d22c830xxxxxxx
        
        // Ubah jadi "true" HANYA jika akun Duitku kamu sudah diverifikasi (Live)
        const IS_PRODUCTION = false; 
        // ====================================================================

        // Tentukan URL tujuan (Sandbox/Uji Coba vs Production/Asli)
        const url = IS_PRODUCTION 
            ? 'https://passport.duitku.com/webapi/api/merchant/v2/inquiry' // LIVE
            : 'https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry'; // SANDBOX

        // 2. Rumus Signature Keamanan Duitku: MD5(merchantCode + idPesanan + totalAmount + apiKey)
        const amountStr = String(total);
        const signatureString = MERCHANT_CODE + idPesanan + amountStr + API_KEY;
        const signature = crypto.createHash('md5').update(signatureString).digest('hex');

        // 3. Menyusun informasi tagihan ke Duitku (Diperbarui ke domain kustom .my.id)
        const requestBody = {
            merchantCode: MERCHANT_CODE,
            paymentAmount: Number(total),
            merchantOrderId: idPesanan,
            productDetails: `Pesanan Unit Produksi SMK Yadika 13 (${idPesanan})`,
            email: "pembeli@smkyadika13.com", // Duitku wajib butuh email, kita buat statis saja
            customerVaName: nama || "Pelanggan",
            returnUrl: "https://unitproduksismkyadika13.my.id", // Redirect pembeli setelah bayar ke domain baru
            callbackUrl: "https://unitproduksismkyadika13.netlify.app/.netlify/functions/duitku-callback", 
            signature: signature,
            expiryPeriod: 60 // Waktu kadaluarsa (60 menit)
        };

        // 4. Mengirim permintaan ke server Duitku
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();

        // 5. Cek apakah Duitku berhasil membalas dengan status "00" (Sukses)
        if (result.statusCode === "00" && result.paymentUrl) {
            return {
                statusCode: 200,
                body: JSON.stringify({ 
                    success: true, 
                    payment_url: result.paymentUrl 
                })
            };
        } else {
            console.error("Duitku Error Response:", JSON.stringify(result));
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    success: false, 
                    message: result.statusMessage || "Gagal mendapatkan link dari Duitku", 
                    detail: result 
                })
            };
        }

    } catch (error) {
        console.error("Server Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, message: error.message })
        };
    }
};