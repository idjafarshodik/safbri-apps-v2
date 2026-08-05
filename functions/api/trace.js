export async function onRequestGet(context) {
  try {
    const response = await fetch(context.env.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': context.env.API_KEY
      },
      body: JSON.stringify({
        nama_pekerjaan: "TEST TRACING KONEKSI",
        tanggal_pekerjaan: "01/01/2026",
        lokasi: "GI Trace",
        tim_pelaksana: "Tim Tester",
        pengawas_k3: "Bapak Trace",
        pengawas_pekerjaan: "Bapak Bug",
        jumlah_pelaksana: "1",
        foto_collage: "data:image/jpeg;base64,T0tFAgIC" 
      })
    });

    const responseText = await response.text();

    return new Response(JSON.stringify({
      "1_HTTP_STATUS": response.status,
      "2_PESAN_DARI_N8N": responseText,
      "3_URL_YANG_DITEMBAK": context.env.N8N_WEBHOOK_URL,
      "4_PASSWORD_YANG_DIKIRIM": context.env.API_KEY
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}