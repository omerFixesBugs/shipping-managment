import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const { type } = body

    if (type === 'shipment_status') {
      return await handleShipmentStatus(supabase, body)
    }
    if (type === 'procurement_status') {
      return await handleProcurementStatus(supabase, body)
    }

    return new Response(JSON.stringify({ error: 'Unknown type' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleShipmentStatus(supabase: any, body: { shipmentId: string; newStatus: string; actorId: string }) {
  const { shipmentId, newStatus, actorId } = body

  const { data: shipment, error: fetchError } = await supabase
    .from('shipments')
    .select('*, clients(name, phone)')
    .eq('id', shipmentId)
    .single()

  if (fetchError || !shipment) {
    return jsonResponse({ error: 'Shipment not found' }, 404)
  }

  const fromStatus = shipment.status
  const updates: Record<string, string> = { status: newStatus }

  if (newStatus === 'in_transit_to_bangladesh') {
    updates.current_hub = 'bangladesh'
  }

  const { error: updateError } = await supabase
    .from('shipments')
    .update(updates)
    .eq('id', shipmentId)

  if (updateError) {
    return jsonResponse({ error: updateError.message }, 400)
  }

  await supabase.from('shipment_events').insert({
    shipment_id: shipmentId,
    from_status: fromStatus,
    to_status: newStatus,
    actor_id: actorId,
  })

  const ownerProfiles = await supabase.from('profiles').select('id, phone').eq('role', 'owner')
  const owners = ownerProfiles.data ?? []

  if (newStatus === 'in_transit_to_bangladesh') {
    const bdManagers = await supabase
      .from('profiles')
      .select('id, phone')
      .eq('role', 'warehouse_manager')
      .eq('hub', 'bangladesh')

    for (const mgr of bdManagers.data ?? []) {
      await createNotification(supabase, mgr.id, 'Shipment In Transit',
        `Shipment ${shipment.reference_code} is in transit to Bangladesh.`,
        `/warehouse/shipments/${shipmentId}`)
      if (mgr.phone) {
        await sendSms(supabase, mgr.phone,
          `LogiFlow: Shipment ${shipment.reference_code} is in transit to Bangladesh warehouse.`)
      }
    }
  }

  if (['arrived_bangladesh', 'ready_for_pickup'].includes(newStatus)) {
    for (const owner of owners) {
      await createNotification(supabase, owner.id, 'Shipment Update',
        `Shipment ${shipment.reference_code} status: ${newStatus.replace(/_/g, ' ')}.`,
        `/owner/shipments/${shipmentId}`)
    }

    if (newStatus === 'ready_for_pickup' && shipment.clients?.phone) {
      await sendSms(supabase, shipment.clients.phone,
        `LogiFlow: Your shipment ${shipment.reference_code} is ready at our Bangladesh warehouse for pickup or delivery.`)
    }
  }

  for (const owner of owners) {
    await createNotification(supabase, owner.id, 'Status Changed',
      `Shipment ${shipment.reference_code}: ${fromStatus} → ${newStatus}`,
      `/owner/shipments/${shipmentId}`)
  }

  return jsonResponse({ success: true })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleProcurementStatus(supabase: any, body: { requestId: string; newStatus: string }) {
  const { requestId, newStatus } = body

  const { data: request } = await supabase
    .from('procurement_requests')
    .select('*, profiles!procurement_requests_owner_id_fkey(id)')
    .eq('id', requestId)
    .single()

  if (!request) {
    return jsonResponse({ error: 'Request not found' }, 404)
  }

  if (newStatus === 'sent') {
    const managers = await supabase
      .from('profiles')
      .select('id, phone')
      .eq('role', 'warehouse_manager')
      .eq('hub', request.target_hub)

    for (const mgr of managers.data ?? []) {
      await createNotification(supabase, mgr.id, 'New Procurement Request',
        `"${request.title}" needs a quote.`,
        `/warehouse/procurement/${requestId}`)
      if (mgr.phone) {
        await sendSms(supabase, mgr.phone,
          `LogiFlow: New procurement request "${request.title}" awaiting your quote.`)
      }
    }
  }

  if (newStatus === 'quoted') {
    const owners = await supabase.from('profiles').select('id, phone').eq('role', 'owner')
    for (const owner of owners.data ?? []) {
      await createNotification(supabase, owner.id, 'Quote Received',
        `A quote has been submitted for "${request.title}".`,
        `/owner/procurement/${requestId}`)
      if (owner.phone) {
        await sendSms(supabase, owner.phone,
          `LogiFlow: Quote received for procurement request "${request.title}". Please review.`)
      }
    }
  }

  if (newStatus === 'approved' || newStatus === 'rejected') {
    const managers = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'warehouse_manager')
      .eq('hub', request.target_hub)

    for (const mgr of managers.data ?? []) {
      await createNotification(supabase, mgr.id, `Procurement ${newStatus}`,
        `Request "${request.title}" has been ${newStatus}.`,
        `/warehouse/procurement/${requestId}`)
    }
  }

  return jsonResponse({ success: true })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createNotification(supabase: any, userId: string, title: string, message: string, link: string) {
  await supabase.from('notifications').insert({ user_id: userId, title, message, link })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendSms(supabase: any, phone: string, message: string) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER')

  if (!accountSid || !authToken || !fromNumber) {
    await supabase.from('sms_logs').insert({
      phone,
      message,
      status: 'skipped',
      error_message: 'Twilio credentials not configured',
    })
    return
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const credentials = btoa(`${accountSid}:${authToken}`)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: phone, From: fromNumber, Body: message }),
  })

  const result = await response.json()

  await supabase.from('sms_logs').insert({
    phone,
    message,
    status: response.ok ? 'sent' : 'failed',
    twilio_sid: result.sid ?? null,
    error_message: response.ok ? null : JSON.stringify(result),
  })
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
