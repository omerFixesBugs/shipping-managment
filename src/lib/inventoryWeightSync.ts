import { supabase } from '@/lib/supabase'
import type { HubType } from '@/types/database'

/** Reserve a storage product for a shipment — stays in_storage until dispatch. */
export async function assignInventoryToShipment(opts: {
  weight_kg: number
  productName: string
  shipmentId: string
  originHub?: HubType
  inventoryId?: string | null
}) {
  const { weight_kg, productName, shipmentId, originHub, inventoryId } = opts
  const patch = { weight_kg, shipment_id: shipmentId }

  if (inventoryId) {
    const { error } = await supabase
      .from('warehouse_inventory')
      .update(patch)
      .eq('id', inventoryId)
      .eq('status', 'in_storage')
    if (error) throw error
    return
  }

  if (originHub) {
    const { error } = await supabase
      .from('warehouse_inventory')
      .update(patch)
      .eq('hub', originHub)
      .eq('status', 'in_storage')
      .eq('name', productName)
      .is('shipment_id', null)
    if (error) throw error
  }
}

/** Sync weight only — used when editing an already-assigned line item. */
export async function syncStorageWeightFromShipmentItem(opts: {
  weight_kg: number
  productName: string
  shipmentId: string
  originHub?: HubType
  inventoryId?: string | null
}) {
  const { weight_kg, productName, shipmentId, originHub, inventoryId } = opts

  if (inventoryId) {
    const { error } = await supabase
      .from('warehouse_inventory')
      .update({ weight_kg })
      .eq('id', inventoryId)
    if (error) throw error
    return
  }

  const { error: assignedErr } = await supabase
    .from('warehouse_inventory')
    .update({ weight_kg })
    .eq('shipment_id', shipmentId)
    .eq('name', productName)
  if (assignedErr) throw assignedErr

  if (originHub) {
    const { error: storageErr } = await supabase
      .from('warehouse_inventory')
      .update({ weight_kg })
      .eq('hub', originHub)
      .eq('status', 'in_storage')
      .eq('name', productName)
    if (storageErr) throw storageErr
  }
}

/** Unreserve storage when a product is removed from a not-yet-shipped shipment. */
export async function releaseInventoryFromShipment(opts: {
  shipmentId: string
  productName: string
  inventoryId?: string | null
}) {
  const { shipmentId, productName, inventoryId } = opts
  const patch = { shipment_id: null }

  if (inventoryId) {
    const { error } = await supabase
      .from('warehouse_inventory')
      .update(patch)
      .eq('id', inventoryId)
      .eq('status', 'in_storage')
    if (error) throw error
    return
  }

  const { error } = await supabase
    .from('warehouse_inventory')
    .update(patch)
    .eq('shipment_id', shipmentId)
    .eq('name', productName)
    .eq('status', 'in_storage')
  if (error) throw error
}
