export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'VITALIX Payment Worker',
        version: '1.0'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (url.pathname === '/create-preference' && request.method === 'POST') {
      try {
        const orderData = await request.json();

        if (!orderData.items || orderData.items.length === 0) {
          return new Response(JSON.stringify({ error: 'No items' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const preference = {
          items: orderData.items.map(function (item) {
            return {
              id: 'item-' + Date.now(),
              title: item.name,
              quantity: 1,
              unit_price: parseFloat(item.price),
              currency_id: 'MXN'
            };
          }),
          payer: {
            name: orderData.firstName || '',
            surname: orderData.lastName || '',
            email: orderData.email || ''
          },
          back_urls: {
            success: 'https://vitalix.fit/?payment=success&ref=' + orderData.referenceNumber,
            failure: 'https://vitalix.fit/?payment=failure&ref=' + orderData.referenceNumber,
            pending: 'https://vitalix.fit/?payment=pending&ref=' + orderData.referenceNumber
          },
          auto_return: 'approved',
          external_reference: orderData.referenceNumber,
          statement_descriptor: 'VITALIX MEXICO'
        };

        const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + env.MP_ACCESS_TOKEN
          },
          body: JSON.stringify(preference)
        });

        const data = await mpResponse.json();

        if (!mpResponse.ok) {
          return new Response(JSON.stringify({ error: 'MP API error', details: data }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          preferenceId: data.id,
          init_point: data.init_point,
          sandbox_init_point: data.sandbox_init_point
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    if (url.pathname === '/webhook' && request.method === 'POST') {
      const data = await request.json();
      console.log('MP Webhook:', data);
      return new Response('OK', { status: 200 });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
};
