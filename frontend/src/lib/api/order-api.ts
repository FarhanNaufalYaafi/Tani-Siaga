import { API_BASE_URL } from './api-url';
import { authenticatedFetch } from './authenticated-fetch';

export type ShippingMethod = 'PICKUP' | 'DIRECT_CONTACT';
export interface OrderReview { message: string; shipping_address: { recipient_name: string; phone_number: string; address: string }; available_shipping_methods: ShippingMethod[]; shop_info: { shop_name: string; address: string; phone_number: string }; item: { cart_item_id: number; product_id: number; name: string; price: number; quantity: number; total_price: number; is_pre_order: boolean; estimated_harvest_date?: string | null; image_url?: string }; subtotal_produk: number; total_pembayaran: number; }
export interface OrderSummary { order_id: number; midtrans_order_id: string; status: string; total_price: number; recipient_name: string; recipient_phone_number: string; recipient_address: string; shipping_method: ShippingMethod; total_items: number; created_at?: string; }
export interface OrderDetail { order_id: number; midtrans_order_id: string; status: string; total_price: number; payment_url?: string | null; shipping_info: { recipient_name: string; phone_number: string; address: string; shipping_method: ShippingMethod; shop_details: { shop_name: string; phone_number: string; address: string; wa_link: string }; disclaimer: string }; items: Array<{ product_name: string; quantity: number; price: number; is_pre_order: boolean; estimated_harvest_date?: string | null }>; buyer_confirmed: boolean; seller_confirmed: boolean; can_confirm_buyer: boolean; can_confirm_seller: boolean; }

export interface SellerManageItem {
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
  is_pre_order: boolean;
}

export interface SellerManageOrder {
  order_id: number;
  midtrans_order_id: string;
  status: string;
  total_price: number;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  shipping_method: ShippingMethod;
  total_items: number;
  created_at?: string;
  buyer_confirmed: boolean;
  seller_confirmed: boolean;
  items: SellerManageItem[];
}

export interface SellerManageResponse {
  message: string;
  filter: 'all' | 'seller_waiting_payment' | 'seller_pending' | 'seller_unconfirmed' | 'seller_cancelled' | 'seller_completed';
  counts: {
    all: number;
    seller_waiting_payment: number;
    seller_pending: number;
    seller_unconfirmed: number;
    seller_cancelled: number;
    seller_completed: number;
  };
  data: SellerManageOrder[];
}

async function request<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  let response: Response;
  try {
    response = await authenticatedFetch(`${API_BASE_URL}${url}`, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('Server terlalu lama merespons. Coba lagi.');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
  const data = await response.json();
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Permintaan pesanan gagal.');
  return data;
}
export function reviewOrder(cartItemId: number): Promise<OrderReview> { return request(`/orders/review/${cartItemId}`, 'POST'); }
export function createPaymentOrder(cartItemId: number, payload: { recipient_name: string; recipient_phone_number: string; recipient_address: string; shipping_method: ShippingMethod }): Promise<{ orderId: number | null; bookedOrderId?: number; paymentURL?: string | null; message: string }> { return request(`/orders/payment/${cartItemId}`, 'POST', payload); }
export function getOrders(): Promise<OrderSummary[]> { return request('/orders'); }
export function getSellerOrders(): Promise<OrderSummary[]> { return request('/orders/seller'); }
export function getSellerOrdersManage(filter: 'all' | 'seller_waiting_payment' | 'seller_pending' | 'seller_unconfirmed' | 'seller_cancelled' | 'seller_completed' = 'all'): Promise<SellerManageResponse> {
  return request(`/orders/seller/manage?filter=${filter}`);
}
export function getOrderDetail(id: string | number): Promise<OrderDetail> { return request(`/orders/${id}`); }
export function confirmOrder(id: string | number): Promise<{ status: string; message: string; buyer_confirmed: boolean; seller_confirmed: boolean }> { return request(`/orders/${id}/confirm`, 'POST'); }
export interface BookedOrder { id: number; orderId?: number | null; productId: number; quantity: number; totalPrice: number; recipientName: string; recipientPhoneNumber: string; recipientAddress: string; shippingMethod: ShippingMethod; status: 'booked' | 'harvested' | 'payment_created' | 'cancelled' | 'expired'; estimatedHarvestDate?: string | null; harvestedAt?: string | null; product?: { id: number; name: string; price: number; image_url?: string[] }; }
export function getBookedOrders(): Promise<BookedOrder[]> { return request('/orders/booked'); }
export function confirmBookedOrder(id: string | number): Promise<{ orderId: number; paymentURL?: string; paymentToken?: string; message: string }> { return request(`/orders/booked/${id}/confirm`, 'POST'); }
export function cancelBookedOrder(id: string | number): Promise<{ message: string }> { return request(`/orders/booked/${id}/cancel`, 'POST'); }
