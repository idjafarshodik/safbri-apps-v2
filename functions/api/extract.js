export async function onRequestPost(context) {
  try {
    const requestData = await context.request.json();
    const response = await fetch(context.env.N8N_EXTRACT_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': context.env.API_KEY
      },
      body: JSON.stringify(requestData)
    });
    const responseData = await response.json(); 
    return new Response(JSON.stringify(responseData), {
      headers: { 'Content-Type': 'application/json' },
      status: response.status
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}