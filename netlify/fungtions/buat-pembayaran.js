const crypto = require('crypto');

exports.handler = async (event, context) => {
    // Hanya izinkan metode POST dari website kita
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Metode tidak diizinkan' };
    }

    try {
        // 1. Menerima data pesanan dari index.html
        const data = JSON.parse(event.body);
        const { idPesanan, total, nama } = data;

        // ====================================================================
        // GANTI BAGIAN INI DENGAN CLIENT ID DAN SECRET KEY KAMU YANG ASLI
        // ====================================================================
        const CLIENT_ID = 'BRN-0243-1788663032393';
        const SECRET_KEY = 'SK-QsyHcfr32V860Emcub52';
        // ====================================================================

        // Kita gunakan URL mode "Sandbox" (Uji Coba) DOKU dulu biar aman
        const targetPath = '/checkout/v1/payment';
        const url = 'https://api-sandbox.doku.com' + targetPath;

        // 2. Membuat data wajib untuk keamanan API DOKU
        const requestId = crypto.randomUUID(); // Bikin ID acak
        const timestamp = new Date().toISOString().slice(0, 19) + "Z"; // Waktu saat ini

        // 3. Menyusun informasi tagihan yang akan dikirim ke DOKU
        const requestBody = {
            order: {
                invoice_number: idPesanan,
                amount: total // Total harga dari keranjang
            },
            payment: {
                payment_due_date: 60 // Waktu kadaluarsa link (60 menit)
            },
            customer: {
                name: nama,
                email: "pembeli@smkyadika13.com" // Email sementara
            }
        };

        const bodyString = JSON.stringify(requestBody);

        // 4. Membuat "Tanda Tangan Digital" (Signature) agar DOKU percaya ini dari kita
        const digest = crypto.createHash('sha256').update(bodyString).digest('base64');
        const signatureComponent = `Client-Id:${CLIENT_ID}\nRequest-Id:${requestId}\nRequest-Timestamp:${timestamp}\nRequest-Target:${targetPath}\nDigest:${digest}`;
        const signature = crypto.createHmac('sha256', SECRET_KEY).update(signatureComponent).digest('base64');

        // 5. Mengirim permintaan (Request) ke Server DOKU
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Client-Id': CLIENT_ID,
                'Request-Id': requestId,
                'Request-Timestamp': timestamp,
                'Signature': 'HMACSHA256=' + signature
            },
            body: bodyString
        });

        const dokuResult = await response.json();

        // 6. Mengecek apakah DOKU berhasil membalas dengan memberikan Link Pembayaran
        if (dokuResult.response && dokuResult.response.payment && dokuResult.response.payment.url) {
            return {
                statusCode: 200,
                body: JSON.stringify({ 
                    success: true, 
                    payment_url: dokuResult.response.payment.url 
                })
            };
        } else {
            console.error("DOKU Error:", dokuResult);
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    success: false, 
                    message: "Gagal mendapatkan link dari DOKU", 
                    detail: dokuResult 
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