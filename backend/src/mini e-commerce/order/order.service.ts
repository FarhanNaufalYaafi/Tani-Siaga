import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { orderStatus } from './enum/order-status.enum';
import { Product } from '../product/entities/product.entity';
import { Order } from './entities/order.entity';
import { CartItems } from '../cart_items/entities/cart_items.entity';
import { OrderItems } from '../order_items/entities/order_items.entity';
import { CreateOrderDto } from './dtos/create-order.dto';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { UserService } from 'src/user/user.service';
import { InjectRepository } from '@nestjs/typeorm';
import * as midtransClient from 'midtrans-client';
import { ShippingMethod } from './enum/shipping-method.enum';
import { NotificationService } from 'src/notification/notification.service';
import { BookedOrder } from './entities/booked-order.entity';
import { bookedOrderStatus } from './enum/booked-order-status.enum';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  private snap: any;
  private coreApi: any;
  private readonly isProduction: boolean;
  private readonly frontendUrl: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(Product) private prodRepo: Repository<Product>,
    @InjectRepository(BookedOrder) private bookedOrderRepo: Repository<BookedOrder>,
    private readonly notificationService: NotificationService,
  ) {
    this.isProduction = this.configService.get<string>('MIDTRANS_IS_PRODUCTION', 'false') === 'true';
    this.frontendUrl = (this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173').replace(/\/+$/, '');
    const serverKey = this.configService.get<string>('MIDTRANS_SERVER_KEY')!;
    const clientKey = this.configService.get<string>('MIDTRANS_CLIENT_KEY')!;

    if (!serverKey || !clientKey) {
      this.logger.error('MIDTRANS_SERVER_KEY atau MIDTRANS_CLIENT_KEY tidak diatur di environment!');
    }

    this.logger.log(
      `Midtrans initialized: isProduction=${this.isProduction}, serverKey starts with=${serverKey?.substring(0, 12)}...`,
    );

    this.snap = new midtransClient.Snap({
      isProduction: this.isProduction,
      serverKey,
      clientKey,
    });

    this.coreApi = new midtransClient.CoreApi({
      isProduction: this.isProduction,
      serverKey,
      clientKey,
    });
  }

  // =========================================================================
  // 1. REVIEW ORDER (Checkout Single Item via cartItemId)
  // =========================================================================
  async reviewOrder(userId: number, cartItemId: number) {
  const user = await this.userService.findOneId(userId);
  if (!user) throw new UnauthorizedException('User tidak ditemukan');

  const cartItem = await this.dataSource.manager.findOne(CartItems, {
    where: {
      id: cartItemId,
      cart: { user: { id: userId } },
    },
    relations: {
      product: { shop: { user: true } },
    },
  });

  if (!cartItem) {
    throw new NotFoundException('Item keranjang tidak ditemukan');
  }

  const shop = cartItem.product.shop;
  const sellerUserId = (shop?.user as any)?.id;
  if (sellerUserId !== undefined && sellerUserId === userId) {
    throw new BadRequestException(
      `Anda tidak bisa membeli produk sendiri (produk "${cartItem.product.name}" dari toko "${shop?.name}").`,
    );
  }

  return {
    message: 'Data checkout berhasil dimuat',
    // 1. Data Penerima Default (diambil dari profil user)
    shipping_address: {
      recipient_name: (user as any).name || (user as any).full_name || '',
      phone_number: (user as any).phone_number || '',
      address: (user as any).address || '',
    },
    // 2. Daftar Opsi Pengiriman yang Tersedia
    available_shipping_methods: Object.values(ShippingMethod),
    // 3. Info Toko Penjual
    shop_info: {
      shop_name: shop?.name || 'Toko Tani',
      address: shop?.location || 'Alamat tidak tersedia',
      phone_number: shop?.phone_number || '-',
    },
    // 4. Detail Barang
    item: {
      cart_item_id: cartItem.id,
      product_id: cartItem.product.id,
      name: cartItem.product.name,
      price: cartItem.product.price,
      quantity: cartItem.quantity,
      total_price: cartItem.total_price,
      is_pre_order: cartItem.product.is_pre_order,
      estimated_harvest_date: cartItem.product.estimated_harvest_date,
      image_url: cartItem.product.image_url?.[0] || '',
    },
    subtotal_produk: cartItem.total_price,
    total_pembayaran: cartItem.total_price,
  };
}
  // =========================================================================
  // 2. CREATE ORDER & PAY (Menerima Alamat & Kontak Langsung dari DTO)
  // =========================================================================
  async payment(userId: number, cartItemId: number, dto: CreateOrderDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const user = await this.userService.findOneId(userId);
    if (!user) throw new UnauthorizedException('User tidak ditemukan');

    try {
      const randomId = randomUUID().replace(/-/g, '').slice(0, 5);
      const midtransOrderId = `O-${userId}-${Date.now()}-${randomId}`;

      const cartItem = await queryRunner.manager.findOne(CartItems, {
        where: {
          id: cartItemId,
          cart: { user: { id: userId } },
        },
        relations: {
          product: { shop: { user: true } },
        },
      });

      if (!cartItem) {
        throw new NotFoundException('Item keranjang tidak ditemukan');
      }

      const shop = cartItem.product.shop;
      const sellerUserId = (shop?.user as any)?.id;
      if (sellerUserId !== undefined && sellerUserId === userId) {
        throw new BadRequestException(
          `Anda tidak bisa membeli produk sendiri (produk "${cartItem.product.name}" dari toko "${shop?.name}").`,
        );
      }

      // Lock produk untuk cegah race condition stok/kuota
      const product = await queryRunner.manager
        .createQueryBuilder(Product, 'product')
        .setLock('pessimistic_write')
        .where('product.id = :id', { id: cartItem.product.id })
        .getOne();

      if (!product) {
        throw new BadRequestException('Produk tidak ditemukan');
      }
      if (!product.is_active) {
        throw new NotFoundException('Produk sudah tidak tersedia. Hapus produk ini dari keranjang.');
      }

      // Validasi & Potong Kuota / Cek Stok
      if (product.is_pre_order) {
        const remainingQuota = (product.po_quota_kg || 0) - product.po_booked_kg;
        if (cartItem.quantity > remainingQuota) {
          throw new BadRequestException(
            `Sisa kuota Pre-Order untuk "${product.name}" tidak mencukupi (Tersisa: ${remainingQuota} Kg).`,
          );
        }
      } else {
        const availableStock = Math.max(0, product.stock - product.po_booked_kg);
        if (cartItem.quantity > availableStock) {
          throw new BadRequestException(
            `Stok untuk "${product.name}" tidak mencukupi (Tersisa: ${availableStock}).`,
          );
        }
      }

      if (product.is_pre_order) {
        const estimatedHarvestDate = product.estimated_harvest_date || null;
        const expiresAt = estimatedHarvestDate ? new Date(estimatedHarvestDate) : null;
        if (expiresAt) expiresAt.setDate(expiresAt.getDate() + 7);
        const bookedOrder = queryRunner.manager.create(BookedOrder, {
          userId,
          productId: product.id,
          quantity: cartItem.quantity,
          totalPrice: cartItem.total_price,
          recipientName: dto.recipient_name,
          recipientPhoneNumber: dto.recipient_phone_number,
          recipientAddress: dto.recipient_address,
          shippingMethod: dto.shipping_method,
          status: bookedOrderStatus.BOOKED,
          estimatedHarvestDate,
          expiresAt,
        });
        const savedBookedOrder = await queryRunner.manager.save(BookedOrder, bookedOrder);
        product.po_booked_kg += cartItem.quantity;
        await queryRunner.manager.save(Product, product);
        await queryRunner.manager.delete(CartItems, { id: cartItem.id });
        await queryRunner.commitTransaction();

        const bookedSellerUserId = (cartItem.product.shop as any)?.user?.id;
        if (bookedSellerUserId) {
          await this.notificationService.createInAppNotification({
            userId: bookedSellerUserId,
            title: 'Pre-order baru masuk',
            message: `Ada pre-order baru untuk produk ${cartItem.product.name}.`,
            type: 'preorder_booked',
            severity: 'warning',
            targetUrl: '/toko/pesanan',
            metadata: { bookedOrderId: savedBookedOrder.id },
          });
        }

        return {
          message: 'Pre-order berhasil dicatat. Pembayaran dibuat setelah panen dan konfirmasi Anda.',
          bookedOrderId: savedBookedOrder.id,
          orderId: null,
          paymentURL: null,
        };
      }

      // Buat Order Utama dengan Menggunakan Data Penerima dari DTO
      const newOrder = queryRunner.manager.create(Order, {
        user: { id: userId },
        status: dto.shipping_method === ShippingMethod.DIRECT_CONTACT ? orderStatus.COMPLETED : orderStatus.PENDING,
        total_price: cartItem.total_price,
        recipient_name: dto.recipient_name,
        recipient_phone_number: dto.recipient_phone_number,
        recipient_address: dto.recipient_address,
        shipping_method: dto.shipping_method,
        midtransOrderId,
        buyer_confirmed: dto.shipping_method === ShippingMethod.DIRECT_CONTACT,
        seller_confirmed: dto.shipping_method === ShippingMethod.DIRECT_CONTACT,
      });

      const saveOrder = await queryRunner.manager.save(Order, newOrder);

      // Buat Order Item
      const orderItemData = queryRunner.manager.create(OrderItems, {
        quantity: cartItem.quantity,
        current_price: cartItem.product.price,
        product: { id: cartItem.product.id },
        order: { id: saveOrder.id },
      });

      await queryRunner.manager.save(OrderItems, orderItemData);

      // Item sudah berubah menjadi pesanan; keluarkan dari cart segera agar
      // tidak bisa dibayar ulang dari keranjang yang sama.
      await queryRunner.manager.delete(CartItems, { id: cartItem.id });

      if (dto.shipping_method === ShippingMethod.DIRECT_CONTACT) {
        product.is_pre_order
          ? (product.po_booked_kg += cartItem.quantity)
          : (product.stock = Math.max(0, product.stock - cartItem.quantity));
        await queryRunner.manager.save(Product, product);
        await queryRunner.commitTransaction();
        return {
          message: 'Pesanan dicatat sebagai transaksi langsung. Silakan hubungi petani.',
          orderId: saveOrder.id,
          total_yang_harus_dibayar: cartItem.total_price,
          paymentURL: null,
          shipping_address: {
            recipient_name: saveOrder.recipient_name,
            recipient_phone_number: saveOrder.recipient_phone_number,
            recipient_address: saveOrder.recipient_address,
          },
        };
      }

      // Payload Midtrans Snap
      const transactionDetails = {
        transaction_details: {
          order_id: midtransOrderId,
          gross_amount: cartItem.total_price,
        },
        item_details: [
          {
            id: product.id.toString(),
            price: product.price,
            quantity: cartItem.quantity,
            name: product.name.substring(0, 50),
            merchant_name: product.shop?.name || 'Toko Tani',
          },
        ],
        credit_card: { secure: true },
        customer_details: {
          first_name: dto.recipient_name,
          email: user.email,
          phone: dto.recipient_phone_number,
          billing_address: {
            first_name: dto.recipient_name,
            phone: dto.recipient_phone_number,
            address: dto.recipient_address,
          },
          shipping_address: {
            first_name: dto.recipient_name,
            phone: dto.recipient_phone_number,
            address: dto.recipient_address,
          },
        },
        expiry: {
          unit: 'day',
          duration: 1, // Expiry time 24 jam
        },
        callbacks: {
          finish: `${this.frontendUrl}/pesanan/${saveOrder.id}`,
        },
      };

      await queryRunner.commitTransaction();

      const midtransTransaction = await this.snap.createTransaction(transactionDetails);

      saveOrder.snap_redirect_url = midtransTransaction.redirect_url;
      await this.orderRepo.save(saveOrder);
      const orderSellerUserId = (cartItem.product.shop as any)?.user?.id;
      if (orderSellerUserId) {
        await this.notificationService.createInAppNotification({
          userId: orderSellerUserId,
          title: 'Pesanan baru masuk',
          message: `Produk ${cartItem.product.name} baru saja dipesan.`,
          type: 'order_created',
          severity: 'warning',
          targetUrl: `/pesanan/${saveOrder.id}`,
          metadata: { orderId: saveOrder.id },
        });
      }

      return {
        message: 'Pesanan berhasil dibuat, silakan lakukan pembayaran',
        orderId: saveOrder.id,
        total_yang_harus_dibayar: cartItem.total_price,
        shipping_address: {
          recipient_name: saveOrder.recipient_name,
          recipient_phone_number: saveOrder.recipient_phone_number,
          recipient_address: saveOrder.recipient_address,
        },
        paymentToken: midtransTransaction.token,
        paymentURL: midtransTransaction.redirect_url,
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // =========================================================================
  // 3. GET ALL ORDERS (Riwayat Pesanan User)
  // =========================================================================
  async getAllUserOrders(userId: number) {
    let orders = await this.orderRepo.find({
      where: { user: { id: userId } },
      relations: {
        orderItems: {
          product: true,
        },
      },
      order: { id: 'DESC' },
    });

    orders = await Promise.all(orders.map((order) => this.syncPendingOrder(order)));

    return orders.map((order) => ({
      order_id: order.id,
      midtrans_order_id: order.midtransOrderId,
      status: order.status,
      total_price: order.total_price,
      recipient_name: order.recipient_name,
      recipient_phone_number: order.recipient_phone_number,
      recipient_address: order.recipient_address,
      shipping_method: order.shipping_method,
      total_items: order.orderItems.length,
      created_at: (order as any).created_At,
    }));
  }

  async getSellerOrders(userId: number) {
    let orders = await this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.orderItems', 'orderItem')
      .leftJoinAndSelect('orderItem.product', 'product')
      .leftJoinAndSelect('product.shop', 'shop')
      .leftJoin('shop.user', 'shopUser')
      .where('shopUser.id = :userId', { userId })
      .orderBy('order.id', 'DESC')
      .getMany();

    orders = await Promise.all(orders.map((order) => this.syncPendingOrder(order)));

    return orders.map((order) => ({
      order_id: order.id,
      midtrans_order_id: order.midtransOrderId,
      status: order.status,
      total_price: order.total_price,
      recipient_name: order.recipient_name,
      recipient_phone: order.recipient_phone_number,
      recipient_address: order.recipient_address,
      shipping_method: order.shipping_method,
      total_items: order.orderItems.length,
      created_at: (order as any).created_At,
      perspective: 'seller',
    }));
  }

  async getSellerOrdersManage(
    userId: number,
    filter: 'all' | 'seller_waiting_payment' | 'seller_pending' | 'seller_unconfirmed' | 'seller_cancelled' | 'seller_completed' = 'all',
  ) {
    let orders = await this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.orderItems', 'orderItem')
      .leftJoinAndSelect('orderItem.product', 'product')
      .leftJoinAndSelect('product.shop', 'shop')
      .leftJoin('shop.user', 'shopUser')
      .where('shopUser.id = :userId', { userId })
      .orderBy('order.id', 'DESC')
      .getMany();

    orders = await Promise.all(orders.map((order) => this.syncPendingOrder(order)));

    const allOrders = orders;
    if (filter === 'seller_waiting_payment') {
      orders = orders.filter((o) => o.status === orderStatus.PENDING);
    } else if (filter === 'seller_pending') {
      orders = orders.filter((o) => o.status !== orderStatus.PENDING && o.status !== orderStatus.CANCEL && !o.seller_confirmed);
    } else if (filter === 'seller_unconfirmed') {
      orders = orders.filter((o) => o.status !== orderStatus.PENDING && o.status !== orderStatus.CANCEL && !o.buyer_confirmed && !o.seller_confirmed);
    } else if (filter === 'seller_cancelled') {
      orders = orders.filter((o) => o.status === orderStatus.CANCEL);
    } else if (filter === 'seller_completed') {
      orders = orders.filter((o) => o.status === orderStatus.COMPLETED && o.buyer_confirmed && o.seller_confirmed);
    }

    return {
      message: `Daftar pesanan toko berhasil dimuat${filter !== 'all' ? ` (filter: ${filter})` : ''}`,
      filter,
      counts: {
        all: allOrders.length,
        seller_waiting_payment: allOrders.filter((o) => o.status === orderStatus.PENDING).length,
        seller_pending: allOrders.filter((o) => o.status !== orderStatus.PENDING && o.status !== orderStatus.CANCEL && !o.seller_confirmed).length,
        seller_unconfirmed: allOrders.filter((o) => o.status !== orderStatus.PENDING && o.status !== orderStatus.CANCEL && !o.buyer_confirmed && !o.seller_confirmed).length,
        seller_cancelled: allOrders.filter((o) => o.status === orderStatus.CANCEL).length,
        seller_completed: allOrders.filter((o) => o.status === orderStatus.COMPLETED && o.buyer_confirmed && o.seller_confirmed).length,
      },
      data: orders.map((order) => ({
        order_id: order.id,
        midtrans_order_id: order.midtransOrderId,
        status: order.status,
        total_price: order.total_price,
        recipient_name: order.recipient_name,
        recipient_phone: order.recipient_phone_number,
        recipient_address: order.recipient_address,
        shipping_method: order.shipping_method,
        total_items: order.orderItems.length,
        created_at: (order as any).created_At,
        buyer_confirmed: order.buyer_confirmed,
        seller_confirmed: order.seller_confirmed,
        items: order.orderItems.map((item) => ({
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.quantity,
          price: item.current_price,
          is_pre_order: item.product.is_pre_order,
        })),
      })),
    };
  }

  // =========================================================================
  // 4. GET ORDER BY ID (Detail Invoice & Informasi Pengiriman)
  // =========================================================================
  async getOrderDetail(userId: number, orderId: number) {
    let order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: {
        user: true,
        orderItems: {
          product: { shop: { user: true } },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Pesanan tidak ditemukan');
    }

    order = await this.syncPendingOrder(order);

    const sellerId = order.orderItems[0]?.product?.shop?.user?.id;
    const isBuyer = order.user.id === userId;
    const isSeller = sellerId === userId;
    if (!isBuyer && !isSeller) throw new UnauthorizedException('Anda tidak terkait dengan pesanan ini');

    const shop = order.orderItems[0]?.product?.shop;

    let formattedPhone = shop?.phone_number || '';
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.slice(1);
    }

    const waText = encodeURIComponent(
      `Halo ${shop?.name || 'Toko'}, saya ingin menanyakan pengiriman untuk Order ID #${order.midtransOrderId}.`,
    );
    const waLink = `https://wa.me/${formattedPhone}?text=${waText}`;

    let midtransPaymentUrl: string | null = null;
    if (order.status === orderStatus.PENDING) {
      midtransPaymentUrl = order.snap_redirect_url || null;
    }

    return {
      order_id: order.id,
      midtrans_order_id: order.midtransOrderId,
      status: order.status,
      total_price: order.total_price,
      payment_url: midtransPaymentUrl,
      shipping_info: {
        recipient_name: order.recipient_name,
        phone_number: order.recipient_phone_number,
        address: order.recipient_address,
        shipping_method: order.shipping_method,
        shop_details: {
          shop_name: shop?.name || 'Toko Tani',
          phone_number: shop?.phone_number || '-',
          address: shop?.location || '-',
          wa_link: waLink,
        },
        disclaimer:
          'Tani Siaga menyediakan opsi Ambil di Tempat sebagai metode utama. Transaksi, kesepakatan ongkir, dan pengiriman via WhatsApp di luar sistem platform sepenuhnya menjadi tanggung jawab antara Pembeli dan Toko.',
      },
      items: order.orderItems.map((item) => ({
        product_name: item.product.name,
        quantity: item.quantity,
        price: item.current_price,
        is_pre_order: item.product.is_pre_order,
        estimated_harvest_date: item.product.estimated_harvest_date,
      })),
      buyer_confirmed: order.buyer_confirmed,
      seller_confirmed: order.seller_confirmed,
      can_confirm_buyer: isBuyer && order.status === orderStatus.PAID,
      can_confirm_seller: isSeller && order.status === orderStatus.PAID,
    };
  }

  private async syncPendingOrder(order: Order): Promise<Order> {
    if (order.status !== orderStatus.PENDING) return order;
    if (!order.midtransOrderId && !order.midtransTransactionId) return order;

    const midtransOrderId = order.midtransOrderId;
    const midtransTxId = order.midtransTransactionId;

    this.logger.debug(
      `Mulai sinkronisasi order #${order.id} (midtransOrderId=${midtransOrderId}, midtransTransactionId=${midtransTxId || 'N/A'}), env=${this.isProduction ? 'PRODUCTION' : 'SANDBOX'}`,
    );

    if (midtransTxId) {
      this.logger.log(
        `Order #${order.id} MEMILIKI midtransTransactionId (${midtransTxId}). Menurut dokumentasi Midtrans DANA/QRIS: get status HARUS menggunakan transaction_id BUKAN order_id.`,
      );
    }

    let statusResponse: any;
    let lookupIdUsed: string | null = null;
    let lookupMethod: string | null = null;

    try {
      const lookupOrder: Array<{ id: string | null | undefined; label: string }> = [];
      if (midtransTxId) {
        lookupOrder.push({ id: midtransTxId, label: 'transaction_id (DANA/QRIS compatible)' });
      }
      lookupOrder.push({ id: midtransOrderId, label: 'order_id (default)' });

      for (const lookup of lookupOrder) {
        if (!lookup.id) continue;
        lookupIdUsed = lookup.id;
        lookupMethod = lookup.label;
        this.logger.debug(
          `Coba get status order #${order.id} via ${lookup.label}: ${lookup.id}`,
        );
        try {
          try {
            statusResponse = await this.snap.transaction.status(lookup.id);
          } catch (snapError: any) {
            this.logger.warn(
              `Snap transaction.status via ${lookup.label} gagal (${lookup.id}): ${snapError.message}. Mencoba CoreApi...`,
            );
            statusResponse = await this.coreApi.transaction.status(lookup.id);
          }
          if (statusResponse && statusResponse.transaction_status) {
            this.logger.log(`Berhasil mendapatkan status via ${lookup.label} (${lookup.id})`);
            break;
          }
        } catch (err: any) {
          const httpCode = err?.httpStatusCode || err?.statusCode || 'N/A';
          this.logger.warn(
            `Gagal get status via ${lookup.label} (${lookup.id}): HTTP=${httpCode}. ${lookupOrder.indexOf(lookup) < lookupOrder.length - 1 ? 'Akan mencoba identifier berikutnya...' : 'Semua identifier sudah dicoba.'}`,
          );
          statusResponse = null;
        }
      }

      if (!statusResponse) {
        if (order.last_midtrans_webhook_status) {
          this.logger.log(
            `SEMUA API get status Midtrans return error. Fallback ke CACHE last_midtrans_webhook_status="${order.last_midtrans_webhook_status}" dari webhook terakhir untuk order #${order.id}.`,
          );
          const cachedPayload = order.last_midtrans_webhook_payload || {};
          statusResponse = {
            transaction_status: order.last_midtrans_webhook_status,
            fraud_status: cachedPayload?.fraud_status || 'accept',
            transaction_id: cachedPayload?.transaction_id || midtransTxId,
            __from_cache_webhook: true,
          };
          lookupMethod = 'fallback cache webhook terakhir';
        } else {
          throw new Error(
            `Tidak bisa mendapatkan status dari Midtrans API untuk semua identifier. Dan belum ada cache webhook. Gunakan POST /orders/replay-webhook dengan payload settlement dari email/dashboard Midtrans untuk trigger update status.`,
          );
        }
      }

      const transactionStatus = statusResponse.transaction_status;
      const fraudStatus = statusResponse.fraud_status;
      const transactionId = statusResponse.transaction_id || midtransTxId;
      this.logger.log(
        `Status Midtrans order #${order.id} [source: ${lookupMethod || 'N/A'}, cache_webhook=${!!statusResponse.__from_cache_webhook}]: order_id=${midtransOrderId}, tx_id=${transactionId} → transaction_status=${transactionStatus}, fraud_status=${fraudStatus}`,
      );

      let nextStatus = orderStatus.PENDING;

      if (transactionStatus === 'capture') {
        nextStatus = fraudStatus === 'accept' ? orderStatus.PAID : orderStatus.CHALLENGE;
      } else if (transactionStatus === 'settlement') {
        nextStatus = orderStatus.PAID;
      } else if (['cancel', 'deny', 'expire', 'failure'].includes(transactionStatus)) {
        nextStatus = orderStatus.CANCEL;
      }

      if (!order.midtransTransactionId && transactionId) {
        order.midtransTransactionId = transactionId;
        try {
          await this.orderRepo.update(order.id, { midtransTransactionId: transactionId });
        } catch (_) { /* ignore */ }
      }

      if (nextStatus === orderStatus.PENDING) return order;

      const freshOrder = await this.orderRepo.findOne({
        where: { id: order.id },
        relations: { user: true, orderItems: { product: true } },
      });
      if (!freshOrder || freshOrder.status !== orderStatus.PENDING) return freshOrder || order;

      if (nextStatus === orderStatus.PAID) {
        await this.settlePaidInventory(freshOrder);
      }

      this.logger.log(
        `Update status order #${order.id} dari PENDING -> ${nextStatus} (source: ${lookupMethod || 'N/A'}, midtransOrderId=${midtransOrderId})`,
      );
      freshOrder.status = nextStatus;
      if (!freshOrder.midtransTransactionId && transactionId) {
        freshOrder.midtransTransactionId = transactionId;
      }
      return await this.orderRepo.save(freshOrder);
    } catch (error: any) {
      const httpCode = error?.httpStatusCode || error?.statusCode || 'N/A';
      const apiResponse = error?.ApiResponse ? JSON.stringify(error.ApiResponse) : error?.message;
      this.logger.warn(
        `Gagal sinkronisasi status Midtrans order #${order.id} (midtransOrderId=${midtransOrderId}, midtransTransactionId=${midtransTxId || 'N/A'}, lookup_id_used=${lookupIdUsed}, env=${this.isProduction ? 'PRODUCTION' : 'SANDBOX'}). HTTP=${httpCode}. Response: ${apiResponse}`,
      );
      if (!midtransTxId) {
        this.logger.warn(
          `💡 ORDER #${order.id} TIDAK PUNYA midtransTransactionId. Untuk DANA/QRIS: DAPATKAN transaction_id dari WEBHOOK/DASHBOARD MIDTRANS terlebih dahulu (panggil POST /orders/replay-webhook dengan payload settlement), karena menurut docs Midtrans DANA wajib pakai transaction_id untuk Get Status!`,
        );
      } else {
        this.logger.warn(
          `💡 Saran: Gunakan POST /orders/replay-webhook copy paste JSON payload dari email Midtrans / dashboard Notification history untuk memaksa proses status.`,
        );
      }
      return order;
    }
  }

  private async settlePaidInventory(order: Order) {
    for (const orderItem of order.orderItems) {
      const product = orderItem.product;
      const bookedOrder = await this.bookedOrderRepo.findOne({
        where: { orderId: order.id, productId: product.id },
      });
      if (product.is_pre_order) {
        product.po_booked_kg += orderItem.quantity;
      } else if (bookedOrder) {
        product.stock = Math.max(0, product.stock - orderItem.quantity);
        product.po_booked_kg = Math.max(0, product.po_booked_kg - orderItem.quantity);
      } else {
        product.stock = Math.max(0, product.stock - orderItem.quantity);
      }
      await this.prodRepo.save(product);

      const staleCartItems = await this.dataSource.manager.find(CartItems, {
        where: { cart: { user: { id: order.user.id } }, product: { id: product.id } },
      });
      if (staleCartItems.length) await this.dataSource.manager.remove(CartItems, staleCartItems);
    }
  }

  async confirmOrder(userId: number, orderId: number) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: { user: true, orderItems: { product: { shop: { user: true } } } },
    });
    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');

    const isBuyer = order.user.id === userId;
    const sellerId = order.orderItems[0]?.product?.shop?.user?.id;
    const isSeller = sellerId === userId;
    if (!isBuyer && !isSeller) throw new UnauthorizedException('Anda tidak terkait dengan pesanan ini');

    if (order.shipping_method === ShippingMethod.DIRECT_CONTACT) {
      order.buyer_confirmed = true;
      order.seller_confirmed = true;
      order.status = orderStatus.COMPLETED;
    } else if (order.status !== orderStatus.PAID && order.status !== orderStatus.COMPLETED) {
      throw new BadRequestException('Pesanan harus sudah dibayar sebelum dikonfirmasi');
    } else if (isBuyer) {
      order.buyer_confirmed = true;
    } else {
      order.seller_confirmed = true;
    }

    if (order.buyer_confirmed && order.seller_confirmed) order.status = orderStatus.COMPLETED;
    await this.orderRepo.save(order);
    const otherUserId = isBuyer ? sellerId : order.user.id;
    if (otherUserId) {
      await this.notificationService.createInAppNotification({
        userId: otherUserId,
        title: isBuyer ? 'Pembeli mengonfirmasi pesanan' : 'Penjual mengonfirmasi pesanan',
        message: isBuyer ? 'Pembeli sudah menyelesaikan konfirmasi pesanan.' : 'Penjual sudah menyelesaikan konfirmasi pesanan.',
        type: 'order_confirmation',
        severity: order.status === orderStatus.COMPLETED ? 'safe' : 'warning',
        targetUrl: `/pesanan/${order.id}`,
        metadata: { orderId: order.id },
      });
    }
    return { message: 'Konfirmasi pesanan berhasil disimpan', status: order.status, buyer_confirmed: order.buyer_confirmed, seller_confirmed: order.seller_confirmed };
  }

  async getBookedOrders(userId: number) {
    return this.bookedOrderRepo.find({ where: { userId }, relations: { product: true }, order: { createdAt: 'DESC' } });
  }

  async confirmBookedOrder(userId: number, bookedOrderId: number) {
    const bookedOrder = await this.bookedOrderRepo.findOne({
      where: { id: bookedOrderId, userId, status: bookedOrderStatus.HARVESTED },
      relations: { product: true },
    });
    if (!bookedOrder) throw new BadRequestException('Booked order belum siap dikonfirmasi atau sudah diproses.');

    const midtransOrderId = `O-${userId}-${Date.now()}-${randomUUID().replace(/-/g, '').slice(0, 5)}`;
    const isDirectContact = bookedOrder.shippingMethod === ShippingMethod.DIRECT_CONTACT;
    const order = await this.orderRepo.save(this.orderRepo.create({
      user: { id: userId },
      status: isDirectContact ? orderStatus.COMPLETED : orderStatus.PENDING,
      total_price: bookedOrder.totalPrice,
      recipient_name: bookedOrder.recipientName,
      recipient_phone_number: bookedOrder.recipientPhoneNumber,
      recipient_address: bookedOrder.recipientAddress,
      shipping_method: bookedOrder.shippingMethod,
      midtransOrderId,
      buyer_confirmed: isDirectContact,
      seller_confirmed: isDirectContact,
    }));
    await this.dataSource.manager.save(OrderItems, this.dataSource.manager.create(OrderItems, {
      quantity: bookedOrder.quantity,
      current_price: bookedOrder.product.price,
      product: { id: bookedOrder.productId },
      order: { id: order.id },
    }));

    if (isDirectContact) {
      bookedOrder.product.stock = Math.max(0, bookedOrder.product.stock - bookedOrder.quantity);
      bookedOrder.product.po_booked_kg = Math.max(0, bookedOrder.product.po_booked_kg - bookedOrder.quantity);
      await this.prodRepo.save(bookedOrder.product);
    }

    const transaction = isDirectContact ? null : await this.snap.createTransaction({
      transaction_details: { order_id: midtransOrderId, gross_amount: bookedOrder.totalPrice },
      item_details: [{ id: String(bookedOrder.productId), price: bookedOrder.product.price, quantity: bookedOrder.quantity, name: bookedOrder.product.name }],
      customer_details: { first_name: bookedOrder.recipientName, phone: bookedOrder.recipientPhoneNumber, address: bookedOrder.recipientAddress },
      shipping_address: { first_name: bookedOrder.recipientName, phone: bookedOrder.recipientPhoneNumber, address: bookedOrder.recipientAddress },
      expiry: { unit: 'day', duration: 1 },
      callbacks: { finish: `${this.frontendUrl}/pesanan/${order.id}` },
    });
    if (transaction) order.snap_redirect_url = transaction.redirect_url;
    await this.orderRepo.save(order);
    bookedOrder.status = bookedOrderStatus.PAYMENT_CREATED;
    bookedOrder.orderId = order.id;
    await this.bookedOrderRepo.save(bookedOrder);
    return { message: isDirectContact ? 'Pesanan langsung berhasil dicatat.' : 'Payment berhasil dibuat.', orderId: order.id, paymentURL: transaction?.redirect_url || null, paymentToken: transaction?.token || null };
  }

  async cancelBookedOrder(userId: number, bookedOrderId: number) {
    const bookedOrder = await this.bookedOrderRepo.findOne({ where: { id: bookedOrderId, userId }, relations: { product: true } });
    if (!bookedOrder) throw new NotFoundException('Booked order tidak ditemukan');
    if (bookedOrder.status !== bookedOrderStatus.BOOKED && bookedOrder.status !== bookedOrderStatus.HARVESTED) {
      throw new BadRequestException('Booked order ini sudah tidak dapat dibatalkan.');
    }
    bookedOrder.status = bookedOrderStatus.CANCELLED;
    bookedOrder.product.po_booked_kg = Math.max(0, bookedOrder.product.po_booked_kg - bookedOrder.quantity);
    await this.prodRepo.save(bookedOrder.product);
    await this.bookedOrderRepo.save(bookedOrder);
    return { message: 'Booked order berhasil dibatalkan.' };
  }

  async markProductHarvested(productId: number, harvestedAt = new Date()) {
    const bookedOrders = await this.bookedOrderRepo.find({ where: { productId, status: bookedOrderStatus.BOOKED }, relations: { product: true } });
    for (const bookedOrder of bookedOrders) {
      bookedOrder.status = bookedOrderStatus.HARVESTED;
      bookedOrder.harvestedAt = harvestedAt;
      await this.bookedOrderRepo.save(bookedOrder);
      await this.notificationService.createInAppNotification({
        userId: bookedOrder.userId,
        title: 'Pre-order sudah panen',
        message: `Produk ${bookedOrder.product.name} sudah dipanen. Konfirmasi untuk melanjutkan pembayaran atau batalkan booked order.`,
        type: 'preorder_harvested',
        severity: 'warning',
        targetUrl: '/pre-order',
        metadata: { bookedOrderId: bookedOrder.id },
      });
    }
    return bookedOrders.length;
  }

  // =========================================================================
  // 6. MANUAL SYNC ORDER (Recovery untuk order yang stuck PENDING)
  // =========================================================================
  async manualSyncOrderById(orderId: number) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: { user: true, orderItems: { product: true } },
    });
    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');

    this.logger.log(`Manual sync diminta untuk order #${orderId}, status saat ini: ${order.status}`);

    const syncedOrder = await this.syncPendingOrder(order);

    return {
      order_id: syncedOrder.id,
      midtrans_order_id: syncedOrder.midtransOrderId,
      previous_status: order.status,
      current_status: syncedOrder.status,
      status_updated: order.status !== syncedOrder.status,
      message:
        order.status !== syncedOrder.status
          ? `Status berhasil diupdate dari ${order.status} menjadi ${syncedOrder.status}`
          : `Status tetap ${syncedOrder.status} (tidak ada perubahan dari Midtrans)`,
    };
  }

  // =========================================================================
  // 7. WEBHOOK MIDTRANS (Deduct Stock & Remove Purchased Cart Item)
  // =========================================================================
  async handleWebhook(notificationDto: any) {
    const midtransOrderId = notificationDto?.order_id;
    const midtransTransactionId = notificationDto?.transaction_id;
    const transactionStatusFromDto = notificationDto?.transaction_status;
    const paymentType = notificationDto?.payment_type;

    this.logger.log(
      `Menerima webhook Midtrans: order_id=${midtransOrderId}, tx_id=${midtransTransactionId}, type=${paymentType}, status=${transactionStatusFromDto}, env=${this.isProduction ? 'PRODUCTION' : 'SANDBOX'}`,
    );

    try {
      let statusResponse: any;
      try {
        statusResponse = await this.snap.transaction.notification(notificationDto);
      } catch (snapError: any) {
        this.logger.warn(
          `Snap transaction.notification gagal (${snapError.message}). Mencoba parse dari payload webhook langsung...`,
        );
        statusResponse = notificationDto;
      }

      if (!midtransOrderId && !midtransTransactionId) {
        this.logger.warn('Webhook Midtrans tidak memiliki order_id ATAU transaction_id');
        return { status: 'success' };
      }

      const transactionStatus = statusResponse?.transaction_status || transactionStatusFromDto;
      const fraudStatus = statusResponse?.fraud_status || notificationDto?.fraud_status;

      this.logger.log(
        `Webhook Midtrans (verified): order_id=${midtransOrderId}, tx_id=${midtransTransactionId}, transaction_status=${transactionStatus}, fraud_status=${fraudStatus}`,
      );

      let order: Order | null = null;
      let matchedBy: string | null = null;

      if (midtransOrderId) {
        order = await this.orderRepo.findOne({
          where: { midtransOrderId },
          relations: { user: true, orderItems: { product: true } },
        });
        if (order) matchedBy = 'order_id';
      }

      if (!order && midtransTransactionId) {
        this.logger.warn(
          `Tidak ditemukan via order_id=${midtransOrderId}. Mencoba via transaction_id=${midtransTransactionId}...`,
        );
        order = await this.orderRepo.findOne({
          where: { midtransTransactionId },
          relations: { user: true, orderItems: { product: true } },
        });
        if (order) {
          matchedBy = 'transaction_id';
          this.logger.log(`Berhasil menemukan order #${order.id} via transaction_id fallback!`);
        }
      }

      if (!order) {
        this.logger.warn(
          `Webhook: Order TIDAK DITEMUKAN (order_id=${midtransOrderId}, transaction_id=${midtransTransactionId}). Midtrans mencoba kirim webhook tapi order tidak ada di DB.`,
        );
        return { status: 'success' };
      }

      this.logger.log(
        `Order #${order.id} ditemukan via ${matchedBy}. Status saat ini: ${order.status}, target: ${transactionStatus}`,
      );

      if (!order.midtransTransactionId && midtransTransactionId) {
        this.logger.log(`Mengisi kolom midtransTransactionId order #${order.id} = ${midtransTransactionId}`);
        await this.orderRepo.update(order.id, { midtransTransactionId });
        order.midtransTransactionId = midtransTransactionId;
      }

      try {
        await this.orderRepo.update(order.id, {
          last_midtrans_webhook_status: transactionStatus || null,
          last_midtrans_webhook_payload: statusResponse || notificationDto || null,
        });
        this.logger.log(
          `Cache webhook order #${order.id} disimpan: last_midtrans_webhook_status=${transactionStatus} (akan jadi fallback jika API get status Midtrans return error/404)`,
        );
      } catch (cacheErr: any) {
        this.logger.warn(`Gagal simpan cache webhook status ke DB untuk order #${order.id}: ${cacheErr.message}`);
      }

      let statusOrder = orderStatus.PENDING;

      if (transactionStatus === 'capture') {
        statusOrder = fraudStatus === 'accept' ? orderStatus.PAID : orderStatus.CHALLENGE;
      } else if (transactionStatus === 'settlement') {
        statusOrder = orderStatus.PAID;
      } else if (
        transactionStatus === 'cancel' ||
        transactionStatus === 'deny' ||
        transactionStatus === 'expire' ||
        transactionStatus === 'failure'
      ) {
        statusOrder = orderStatus.CANCEL;
      }

      if (order.status === statusOrder) {
        this.logger.log(`Order #${order.id} sudah memiliki status ${statusOrder}, skip update`);
        return { status: 'success' };
      }

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const updateFields: any = { status: statusOrder };
        if (!order.midtransTransactionId && midtransTransactionId) {
          updateFields.midtransTransactionId = midtransTransactionId;
        }
        await queryRunner.manager.update(Order, order.id, updateFields);
        this.logger.log(`Status order #${order.id} diupdate via webhook: ${order.status} -> ${statusOrder}`);

        if (statusOrder === orderStatus.PAID && order.status !== orderStatus.PAID) {
          this.logger.log(`Memproses inventory deduction untuk order #${order.id} (${order.orderItems.length} item)`);
          for (const orderItem of order.orderItems) {
            const product = orderItem.product;
            const bookedOrder = await queryRunner.manager.findOne(BookedOrder, {
              where: { orderId: order.id, productId: product.id },
            });

            if (product.is_pre_order) {
              await queryRunner.manager.update(Product, product.id, {
                po_booked_kg: product.po_booked_kg + orderItem.quantity,
              });
            } else if (bookedOrder) {
              await queryRunner.manager.update(Product, product.id, {
                stock: Math.max(0, product.stock - orderItem.quantity),
                po_booked_kg: Math.max(0, product.po_booked_kg - orderItem.quantity),
              });
            } else {
              await queryRunner.manager.update(Product, product.id, {
                stock: Math.max(0, product.stock - orderItem.quantity),
              });
            }

            await queryRunner.manager.delete(CartItems, {
              cart: { user: { id: order.user.id } },
              product: { id: product.id },
            });
          }
          this.logger.log(`Inventory deduction selesai untuk order #${order.id}`);
        }
        await queryRunner.commitTransaction();
        return { status: 'success' };
      } catch (error) {
        if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error: any) {
      this.logger.error(
        `Webhook Midtrans error (order_id=${midtransOrderId}, tx_id=${midtransTransactionId}): ${error?.message || JSON.stringify(error)}`,
        error?.stack,
      );
      return { status: 'error', message: error?.message || 'Unknown error' };
    }
  }
}