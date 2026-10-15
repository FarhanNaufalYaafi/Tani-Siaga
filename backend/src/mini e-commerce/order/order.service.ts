import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { orderStatus } from './enum/order-status.enum';
import { Product } from '../product/entities/product.entity';
import { ProductReview } from '../product/entities/product-review.entity';
import { Order } from './entities/order.entity';
import { CartItems } from '../cart_items/entities/cart_items.entity';
import { OrderItems } from '../order_items/entities/order_items.entity';
import { CreateOrderDto } from './dtos/create-order.dto';
import { randomUUID } from 'crypto';
import axios from 'axios';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { LessThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
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
  private readonly midtransServerKey: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(Product) private prodRepo: Repository<Product>,
    @InjectRepository(BookedOrder) private bookedOrderRepo: Repository<BookedOrder>,
    @InjectRepository(ProductReview) private productReviewRepo: Repository<ProductReview>,
    private readonly notificationService: NotificationService,
  ) {
    this.isProduction = this.configService.get<string>('MIDTRANS_IS_PRODUCTION', 'false') === 'true';
    this.frontendUrl = (this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173').replace(/\/+$/, '');
    const serverKey = this.configService.get<string>('MIDTRANS_SERVER_KEY')!;
    const clientKey = this.configService.get<string>('MIDTRANS_CLIENT_KEY')!;
    this.midtransServerKey = serverKey;

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
  if (!shop?.is_active || (shop.banned_until && new Date(shop.banned_until) > new Date())) {
    throw new BadRequestException('Toko sedang tidak dapat menerima transaksi.');
  }
  if (!cartItem.product.is_active || cartItem.product.approval_status !== 'approved') {
    throw new BadRequestException('Produk belum tersedia untuk transaksi.');
  }
  const availableQuantity = cartItem.product.is_pre_order
    ? Math.max(0, cartItem.product.po_quota_kg - cartItem.product.po_booked_kg)
    : Math.max(0, cartItem.product.stock - cartItem.product.po_booked_kg);
  if (availableQuantity < 1) {
    await this.dataSource.manager.delete(CartItems, { id: cartItem.id });
    throw new BadRequestException(`Stok ${cartItem.product.name} habis. Item otomatis dihapus dari keranjang.`);
  }
  if (cartItem.quantity > availableQuantity) {
    cartItem.quantity = availableQuantity;
    cartItem.total_price = availableQuantity * Number(cartItem.product.price);
    await this.dataSource.manager.save(CartItems, cartItem);
  }
  const sellerUserId = (shop?.user as any)?.id;
  if (sellerUserId !== undefined && sellerUserId === userId) {
    throw new BadRequestException(
      `Anda tidak bisa membeli produk sendiri (produk "${cartItem.product.name}" dari toko "${shop?.name}").`,
    );
  }

  const isPreOrder = cartItem.product.is_pre_order;
  if (isPreOrder && cartItem.total_price < 2) {
    throw new BadRequestException('Total pre-order terlalu kecil untuk dibagi menjadi DP dan pelunasan.');
  }
  const depositAmount = isPreOrder ? Math.max(1, Math.min(Number(cartItem.total_price) - 1, Math.round(Number(cartItem.total_price) * 0.3))) : null;

  return {
    message: 'Data checkout berhasil dimuat',
    // 1. Data Penerima Default (diambil dari profil user)
    shipping_address: {
      recipient_name: (user as any).name || (user as any).full_name || '',
      phone_number: (user as any).phone_number || '',
      address: (user as any).address || '',
    },
    // 2. Daftar Opsi Pengiriman yang Tersedia
    available_shipping_methods: isPreOrder ? [ShippingMethod.PICKUP] : Object.values(ShippingMethod),
    preorder_payment: isPreOrder && depositAmount !== null
      ? { total_amount: Number(cartItem.total_price), deposit_amount: depositAmount, remaining_amount: Number(cartItem.total_price) - depositAmount }
      : null,
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

  private async notifyBuyerReviewReminder(userId: number, orderId: number, productId: number, productName: string) {
    const existingReview = await this.productReviewRepo.findOne({ where: { userId, productId } });
    const hasReview = Boolean(existingReview);
    await this.notificationService.createInAppNotification({
      userId,
      title: hasReview ? 'Perbarui ulasan?' : 'Berikan ulasan produk',
      message: hasReview
        ? `Pesanan "${productName}" selesai lagi. Perbarui ulasan Anda?`
        : `Pesanan "${productName}" sudah selesai. Berikan ulasan Anda untuk produk ini.`,
      type: 'product_review_reminder',
      severity: 'safe',
      targetUrl: `/e-commerce/${productId}#ulasan-pembeli`,
      metadata: { orderId, productId },
    });
  }

  async reviewBuyNow(userId: number, productId: number, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BadRequestException('Jumlah produk minimal 1 dan harus berupa bilangan bulat.');
    }

    const user = await this.userService.findOneId(userId);
    if (!user) throw new UnauthorizedException('User tidak ditemukan');
    const product = await this.prodRepo.findOne({
      where: { id: productId },
      relations: { shop: { user: true } },
    });
    if (!product || !product.is_active || product.approval_status !== 'approved') {
      throw new NotFoundException('Produk sudah tidak tersedia.');
    }

    const shop = product.shop;
    if (!shop?.is_active || (shop.banned_until && new Date(shop.banned_until) > new Date())) {
      throw new BadRequestException('Toko sedang tidak dapat menerima transaksi.');
    }
    if ((shop.user as any)?.id === userId) {
      throw new BadRequestException(`Anda tidak bisa membeli produk sendiri (produk "${product.name}").`);
    }

    const availableQuantity = product.is_pre_order
      ? Math.max(0, product.po_quota_kg - product.po_booked_kg)
      : Math.max(0, product.stock - product.po_booked_kg);
    if (quantity > availableQuantity) {
      throw new BadRequestException(`Jumlah melebihi ketersediaan. Maksimal ${availableQuantity}.`);
    }

    const totalPrice = quantity * Number(product.price);
    if (product.is_pre_order && totalPrice < 2) {
      throw new BadRequestException('Total pre-order terlalu kecil untuk dibagi menjadi DP dan pelunasan.');
    }
    const depositAmount = product.is_pre_order
      ? Math.max(1, Math.min(totalPrice - 1, Math.round(totalPrice * 0.3)))
      : null;

    return {
      message: 'Data checkout berhasil dimuat',
      shipping_address: {
        recipient_name: (user as any).name || (user as any).full_name || '',
        phone_number: (user as any).phone_number || '',
        address: (user as any).address || '',
      },
      available_shipping_methods: product.is_pre_order ? [ShippingMethod.PICKUP] : Object.values(ShippingMethod),
      preorder_payment: product.is_pre_order && depositAmount !== null
        ? { total_amount: totalPrice, deposit_amount: depositAmount, remaining_amount: totalPrice - depositAmount }
        : null,
      shop_info: {
        shop_name: shop?.name || 'Toko Tani',
        address: shop?.location || 'Alamat tidak tersedia',
        phone_number: shop?.phone_number || '-',
      },
      item: {
        cart_item_id: 0,
        product_id: product.id,
        name: product.name,
        price: product.price,
        quantity,
        total_price: totalPrice,
        is_pre_order: product.is_pre_order,
        estimated_harvest_date: product.estimated_harvest_date,
        image_url: product.image_url?.[0] || '',
      },
      subtotal_produk: totalPrice,
      total_pembayaran: totalPrice,
    };
  }

  async buyNow(userId: number, productId: number, dto: CreateOrderDto) {
    const quantity = Number(dto.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BadRequestException('Jumlah produk minimal 1 dan harus berupa bilangan bulat.');
    }
    return this.payment(userId, null, dto, { productId, quantity });
  }
  // =========================================================================
  // 2. CREATE ORDER & PAY (Menerima Alamat & Kontak Langsung dari DTO)
  // =========================================================================
  private async createPreorderDepositOrder(
    manager: EntityManager,
    booking: BookedOrder,
    product: Product,
    midtransOrderId: string,
  ) {
    const existingOrder = await manager.findOne(Order, { where: { midtransOrderId } });
    if (existingOrder) return existingOrder;

    const order = await manager.save(Order, manager.create(Order, {
      user: { id: booking.userId },
      status: orderStatus.PENDING,
      total_price: booking.totalPrice,
      payment_amount: booking.depositAmount,
      preorder_deposit_amount: booking.depositAmount,
      recipient_name: booking.recipientName,
      recipient_phone_number: booking.recipientPhoneNumber,
      recipient_address: booking.recipientAddress,
      shipping_method: ShippingMethod.PICKUP,
      midtransOrderId,
      buyer_confirmed: false,
      seller_confirmed: false,
    }));

    await manager.save(OrderItems, manager.create(OrderItems, {
      quantity: booking.quantity,
      current_price: Math.round(booking.totalPrice / booking.quantity),
      product: { id: product.id },
      order: { id: order.id },
    }));
    booking.orderId = order.id;
    return order;
  }

  async payment(
    userId: number,
    cartItemId: number | null,
    dto: CreateOrderDto,
    buyNow?: { productId: number; quantity: number },
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const user = await this.userService.findOneId(userId);
    if (!user) throw new UnauthorizedException('User tidak ditemukan');

    try {
      const randomId = randomUUID().replace(/-/g, '').slice(0, 5);
      const midtransOrderId = `O-${userId}-${Date.now()}-${randomId}`;

      let cartItem: CartItems | null;
      if (buyNow) {
        const buyNowProduct = await queryRunner.manager.findOne(Product, {
          where: { id: buyNow.productId },
          relations: { shop: { user: true } },
        });
        cartItem = buyNowProduct
          ? queryRunner.manager.create(CartItems, {
              quantity: buyNow.quantity,
              total_price: buyNow.quantity * Number(buyNowProduct.price),
              product: buyNowProduct,
            })
          : null;
      } else {
        cartItem = await queryRunner.manager.findOne(CartItems, {
          where: { id: cartItemId!, cart: { user: { id: userId } } },
          relations: { product: { shop: { user: true } } },
        });
      }

      if (!cartItem) {
        throw new NotFoundException('Item keranjang tidak ditemukan');
      }

      const shop = cartItem.product.shop;
      if (!shop?.is_active || (shop.banned_until && new Date(shop.banned_until) > new Date())) {
        throw new BadRequestException('Toko sedang tidak dapat menerima transaksi.');
      }
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
      if (!product.is_active || product.approval_status !== 'approved') {
        throw new NotFoundException('Produk sudah tidak tersedia. Hapus produk ini dari keranjang.');
      }

      // Create the booking request; reserve quota only after Midtrans confirms the deposit.
      if (product.is_pre_order) {
        if (dto.shipping_method !== ShippingMethod.PICKUP) {
          throw new BadRequestException('Pre-order hanya menggunakan metode Pickup. Hubungi petani tersedia setelah produk menjadi ready stock.');
        }
        if (cartItem.total_price < 2) {
          throw new BadRequestException('Total pre-order terlalu kecil untuk dibagi menjadi DP dan pelunasan.');
        }

        const remainingQuota = Math.max(0, (product.po_quota_kg || 0) - product.po_booked_kg);
        if (cartItem.quantity > remainingQuota) {
          if (remainingQuota < 1 && !buyNow) {
            await queryRunner.manager.delete(CartItems, { id: cartItem.id });
            await queryRunner.commitTransaction();
            throw new BadRequestException(`Kuota pre-order ${product.name} habis. Item otomatis dihapus dari keranjang.`);
          }
          throw new BadRequestException(`Sisa kuota Pre-Order untuk "${product.name}" tidak mencukupi (Tersisa: ${remainingQuota} Kg).`);
        }

        const totalPrice = Number(cartItem.total_price);
        const depositAmount = Math.max(1, Math.min(totalPrice - 1, Math.round(totalPrice * 0.3)));
        const remainingAmount = totalPrice - depositAmount;
        const depositExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const bookedOrder = queryRunner.manager.create(BookedOrder, {
          userId,
          productId: product.id,
          quantity: cartItem.quantity,
          totalPrice,
          depositAmount,
          remainingAmount,
          depositStatus: 'pending',
          depositMidtransOrderId: null,
          depositMidtransTransactionId: null,
          depositPaymentUrl: null,
          depositExpiresAt,
          balancePaymentUrl: null,
          recipientName: dto.recipient_name,
          recipientPhoneNumber: dto.recipient_phone_number,
          recipientAddress: dto.recipient_address,
          shippingMethod: ShippingMethod.PICKUP,
          status: bookedOrderStatus.WAITING_DEPOSIT,
          estimatedHarvestDate: product.estimated_harvest_date || null,
          expiresAt: null,
        });
        const savedBookedOrder = await queryRunner.manager.save(BookedOrder, bookedOrder);
        const depositMidtransOrderId = `PO-DP-${savedBookedOrder.id}-${randomUUID().replace(/-/g, '').slice(0, 8)}`;

        if (!buyNow) await queryRunner.manager.delete(CartItems, { id: cartItem.id });

        const depositOrder = await this.createPreorderDepositOrder(
          queryRunner.manager,
          savedBookedOrder,
          product,
          depositMidtransOrderId,
        );

        const depositTransaction = await this.snap.createTransaction({
          transaction_details: { order_id: depositMidtransOrderId, gross_amount: depositAmount },
          item_details: [{
            id: `deposit-${savedBookedOrder.id}`,
            price: depositAmount,
            quantity: 1,
            name: `DP Pre-order 30% ${product.name}`.substring(0, 50),
          }],
          credit_card: { secure: true },
          customer_details: {
            first_name: dto.recipient_name,
            email: user.email,
            phone: dto.recipient_phone_number,
          },
          expiry: { unit: 'day', duration: 1 },
          callbacks: { finish: `${this.frontendUrl}/pesanan/${depositOrder.id}` },
        });

        depositOrder.snap_redirect_url = depositTransaction.redirect_url;
        await queryRunner.manager.save(Order, depositOrder);
        savedBookedOrder.depositMidtransOrderId = depositMidtransOrderId;
        savedBookedOrder.depositPaymentUrl = depositTransaction.redirect_url;
        await queryRunner.manager.save(BookedOrder, savedBookedOrder);
        await queryRunner.commitTransaction();

        return {
          message: 'Booking pre-order dibuat. Selesaikan DP 30% agar kuota terkunci.',
          bookedOrderId: savedBookedOrder.id,
          orderId: depositOrder.id,
          paymentURL: depositTransaction.redirect_url,
          paymentToken: depositTransaction.token,
          totalPrice,
          depositAmount,
          remainingAmount,
        };
      }

      const availableStock = Math.max(0, product.stock - product.po_booked_kg);
      if (cartItem.quantity > availableStock) {
        if (availableStock < 1 && !buyNow) {
          await queryRunner.manager.delete(CartItems, { id: cartItem.id });
          await queryRunner.commitTransaction();
          throw new BadRequestException(`Stok ${product.name} habis. Item otomatis dihapus dari keranjang.`);
        }
        throw new BadRequestException(`Stok untuk "${product.name}" tidak mencukupi (Tersisa: ${availableStock}).`);
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
      if (!buyNow) await queryRunner.manager.delete(CartItems, { id: cartItem.id });

      if (dto.shipping_method === ShippingMethod.DIRECT_CONTACT) {
        product.is_pre_order
          ? (product.po_booked_kg += cartItem.quantity)
          : (product.stock = Math.max(0, product.stock - cartItem.quantity));
        await queryRunner.manager.save(Product, product);
        await queryRunner.commitTransaction();
        await this.notifyBuyerReviewReminder(userId, saveOrder.id, product.id, product.name);
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
        is_preorder_order: order.midtransOrderId.startsWith('PO-DP-') || order.midtransOrderId.startsWith('PO-BAL-'),
        is_preorder_deposit: order.midtransOrderId.startsWith('PO-DP-'),
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
    const isPreorderOrder = order.midtransOrderId.startsWith('PO-DP-') || order.midtransOrderId.startsWith('PO-BAL-');
    const isPreorderDeposit = order.midtransOrderId.startsWith('PO-DP-');

    let formattedPhone = shop?.phone_number || '';
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.slice(1);
    }

    const waText = encodeURIComponent(
      `Halo ${shop?.name || 'Toko'}, saya ingin menanyakan pengiriman untuk Order ID #${order.midtransOrderId}.`,
    );
    const waLink = isPreorderOrder ? '' : `https://wa.me/${formattedPhone}?text=${waText}`;

    let midtransPaymentUrl: string | null = null;
    if (order.status === orderStatus.PENDING) {
      midtransPaymentUrl = order.snap_redirect_url || null;
    }

    return {
      order_id: order.id,
      midtrans_order_id: order.midtransOrderId,
      status: order.status,
      total_price: order.total_price,
      payment_amount: order.payment_amount,
      preorder_deposit_amount: order.preorder_deposit_amount,
      is_preorder_order: isPreorderOrder,
      is_preorder_deposit: isPreorderDeposit,
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
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        price: item.current_price,
        is_pre_order: item.product.is_pre_order,
        estimated_harvest_date: item.product.estimated_harvest_date,
      })),
      buyer_confirmed: order.buyer_confirmed,
      seller_confirmed: order.seller_confirmed,
      can_confirm_buyer: !isPreorderDeposit && isBuyer && order.status === orderStatus.PAID,
      can_confirm_seller: !isPreorderDeposit && isSeller && order.status === orderStatus.PAID,
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
      const savedOrder = await this.orderRepo.save(freshOrder);
      await this.updateBookedOrderAfterBalance(savedOrder.id, nextStatus);
      return savedOrder;
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

  private async updateBookedOrderAfterBalance(orderId: number, status: orderStatus) {
    const bookedOrder = await this.bookedOrderRepo.findOne({ where: { orderId } });
    if (!bookedOrder || bookedOrder.status !== bookedOrderStatus.PAYMENT_CREATED) return;

    if (status === orderStatus.PAID) {
      bookedOrder.status = bookedOrderStatus.COMPLETED;
      bookedOrder.balancePaymentUrl = null;
    } else if (status === orderStatus.CANCEL) {
      bookedOrder.status = bookedOrderStatus.HARVESTED;
      bookedOrder.orderId = null;
      bookedOrder.balancePaymentUrl = null;
    } else {
      return;
    }
    await this.bookedOrderRepo.save(bookedOrder);
  }

  async confirmOrder(userId: number, orderId: number) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: { user: true, orderItems: { product: { shop: { user: true } } } },
    });
    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');
    const wasCompleted = order.status === orderStatus.COMPLETED;

    const isBuyer = order.user.id === userId;
    const sellerId = order.orderItems[0]?.product?.shop?.user?.id;
    const isSeller = sellerId === userId;
    if (!isBuyer && !isSeller) throw new UnauthorizedException('Anda tidak terkait dengan pesanan ini');
    if (order.status === orderStatus.CANCEL) throw new BadRequestException('Pesanan yang sudah dibatalkan tidak dapat dikonfirmasi kembali.');
    if (order.midtransOrderId.startsWith('PO-DP-')) {
      throw new BadRequestException('Konfirmasi pre-order dilakukan melalui halaman Pre-order Saya.');
    }

    const sellerShop = order.orderItems[0]?.product?.shop;
    if (isSeller && sellerShop?.banned_until && new Date(sellerShop.banned_until) > new Date()) {
      throw new ForbiddenException(`Toko sedang dinonaktifkan sampai ${new Date(sellerShop.banned_until).toLocaleDateString('id-ID')}. Konfirmasi pesanan tidak tersedia selama masa sanksi.`);
    }

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
    if (order.status === orderStatus.COMPLETED) {
      await this.bookedOrderRepo.update(
        { orderId: order.id, status: bookedOrderStatus.PAYMENT_CREATED },
        { status: bookedOrderStatus.COMPLETED },
      );
      if (!wasCompleted && order.orderItems.length) {
        for (const item of order.orderItems) {
          await this.notifyBuyerReviewReminder(order.user.id, order.id, item.product.id, item.product.name);
        }
      }
    }
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

  async cancelDirectContactOrderBySeller(userId: number, orderId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let buyerId: number | null = null;
    try {
      const order = await queryRunner.manager.findOne(Order, {
        where: { id: orderId },
        relations: { user: true, orderItems: { product: { shop: { user: true } } } },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Pesanan tidak ditemukan.');
      if (order.shipping_method !== ShippingMethod.DIRECT_CONTACT || order.status !== orderStatus.COMPLETED) {
        throw new BadRequestException('Hanya transaksi Hubungi petani yang sudah tercatat yang dapat dibatalkan oleh toko.');
      }
      if (!order.orderItems.length || order.orderItems.some((item) => item.product.is_pre_order)) {
        throw new BadRequestException('Pembatalan ini hanya tersedia untuk transaksi ready stock.');
      }
      if (order.orderItems.some((item) => item.product.shop?.user?.id !== userId)) {
        throw new ForbiddenException('Anda tidak memiliki akses untuk membatalkan pesanan ini.');
      }

      for (const item of order.orderItems) {
        const product = await queryRunner.manager
          .createQueryBuilder(Product, 'product')
          .setLock('pessimistic_write')
          .where('product.id = :productId', { productId: item.product.id })
          .getOne();
        if (product) {
          product.stock += item.quantity;
          await queryRunner.manager.save(Product, product);
        }
      }

      order.status = orderStatus.CANCEL;
      await queryRunner.manager.save(Order, order);
      buyerId = order.user.id;
      await queryRunner.commitTransaction();
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    if (buyerId) {
      await this.notificationService.createInAppNotification({
        userId: buyerId,
        title: 'Transaksi langsung dibatalkan toko',
        message: 'Toko membatalkan transaksi Hubungi petani. Stok produk dikembalikan ke toko.',
        type: 'order_cancelled',
        severity: 'warning',
        targetUrl: '/pesanan',
        metadata: { orderId },
      });
    }
    return { message: 'Transaksi langsung dibatalkan dan stok ready stock dikembalikan.' };
  }

  async getBookedOrders(userId: number) {
    const bookings = await this.bookedOrderRepo.find({ where: { userId }, relations: { product: true }, order: { createdAt: 'DESC' } });
    const orderIds = bookings.flatMap((booking) => booking.orderId ? [booking.orderId] : []);
    const balanceOrders = orderIds.length ? await this.orderRepo.find({ where: { id: In(orderIds) } }) : [];
    const balanceOrdersById = new Map(balanceOrders.map((order) => [order.id, order]));

    return bookings.map((booking) => {
      const balanceOrder = booking.orderId ? balanceOrdersById.get(booking.orderId) : undefined;
      const isOrderConfirmed = balanceOrder?.status === orderStatus.COMPLETED
        && balanceOrder.buyer_confirmed
        && balanceOrder.seller_confirmed;
      return {
        ...booking,
        status: booking.status === bookedOrderStatus.COMPLETED && balanceOrder && !isOrderConfirmed
          ? bookedOrderStatus.PAYMENT_CREATED
          : booking.status,
        balancePaymentStatus: balanceOrder?.status ?? null,
      };
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expireUnpaidPreorderDeposits() {
    const expired = await this.bookedOrderRepo.find({
      where: {
        status: bookedOrderStatus.WAITING_DEPOSIT,
        depositExpiresAt: LessThanOrEqual(new Date()),
      },
      select: { depositMidtransOrderId: true },
    });

    for (const booking of expired) {
      if (booking.depositMidtransOrderId) {
        await this.processPreorderDepositStatus(booking.depositMidtransOrderId, 'expire');
      }
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expireHarvestedPreorders() {
    const bookings = await this.bookedOrderRepo.find({
      where: { status: In([bookedOrderStatus.HARVESTED, bookedOrderStatus.PAYMENT_CREATED]) },
    });
    const now = Date.now();
    for (const booking of bookings) {
      const deadline = booking.expiresAt?.getTime()
        ?? (booking.harvestedAt ? booking.harvestedAt.getTime() + 72 * 60 * 60 * 1000 : null);
      if (deadline !== null && deadline <= now) {
        if (booking.status === bookedOrderStatus.PAYMENT_CREATED && booking.orderId) {
          const balanceOrder = await this.orderRepo.findOne({ where: { id: booking.orderId } });
          if (balanceOrder?.status === orderStatus.PENDING) {
            await this.syncPendingOrder(balanceOrder);
          }
        }
        await this.expireHarvestedBooking(booking.id);
      }
    }
  }

  private async expireHarvestedBooking(bookedOrderId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let expiredBooking: BookedOrder | null = null;
    let balanceOrderToCancel: Order | null = null;
    let expiredProductName = 'produk pre-order';
    try {
      const booking = await queryRunner.manager.findOne(BookedOrder, {
        where: { id: bookedOrderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!booking || ![bookedOrderStatus.HARVESTED, bookedOrderStatus.PAYMENT_CREATED].includes(booking.status)) {
        await queryRunner.commitTransaction();
        return false;
      }

      const deadline = booking.expiresAt?.getTime()
        ?? (booking.harvestedAt ? booking.harvestedAt.getTime() + 72 * 60 * 60 * 1000 : null);
      if (deadline === null || deadline > Date.now()) {
        await queryRunner.commitTransaction();
        return false;
      }

      if (booking.status === bookedOrderStatus.PAYMENT_CREATED && booking.orderId) {
        balanceOrderToCancel = await queryRunner.manager.findOne(Order, {
          where: { id: booking.orderId },
          lock: { mode: 'pessimistic_write' },
        });
        if (balanceOrderToCancel?.status === orderStatus.PAID) {
          booking.status = bookedOrderStatus.COMPLETED;
          booking.balancePaymentUrl = null;
          await queryRunner.manager.save(BookedOrder, booking);
          await queryRunner.commitTransaction();
          return false;
        }
      }

      const product = await queryRunner.manager
        .createQueryBuilder(Product, 'product')
        .setLock('pessimistic_write')
        .where('product.id = :productId', { productId: booking.productId })
        .getOne();
      if (!product) throw new NotFoundException('Produk pre-order tidak ditemukan.');
      expiredProductName = product.name;

      if (balanceOrderToCancel) {
        if (balanceOrderToCancel?.status === orderStatus.PENDING || balanceOrderToCancel?.status === orderStatus.CHALLENGE) {
          balanceOrderToCancel.status = orderStatus.CANCEL;
          await queryRunner.manager.save(Order, balanceOrderToCancel);
        }
      }

      product.po_booked_kg = Math.max(0, product.po_booked_kg - booking.quantity);
      await queryRunner.manager.save(Product, product);
      booking.status = bookedOrderStatus.EXPIRED;
      booking.balancePaymentUrl = null;
      if (!booking.expiresAt && booking.harvestedAt) {
        booking.expiresAt = new Date(booking.harvestedAt.getTime() + 72 * 60 * 60 * 1000);
      }
      await queryRunner.manager.save(BookedOrder, booking);
      expiredBooking = booking;
      await queryRunner.commitTransaction();
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    if (balanceOrderToCancel && (balanceOrderToCancel.status === orderStatus.CANCEL || balanceOrderToCancel.status === orderStatus.PENDING || balanceOrderToCancel.status === orderStatus.CHALLENGE)) {
      const transactionId = balanceOrderToCancel.midtransTransactionId || balanceOrderToCancel.midtransOrderId;
      try {
        await this.coreApi.transaction.cancel(transactionId);
      } catch (error: any) {
        this.logger.warn(`Gagal membatalkan pembayaran pelunasan Midtrans ${balanceOrderToCancel.midtransOrderId} setelah tenggat preorder: ${error.message}`);
      }
    }
    if (expiredBooking) {
      await this.notificationService.createInAppNotification({
        userId: expiredBooking.userId,
        title: 'Tenggat pelunasan pre-order terlewat',
        message: `DP untuk ${expiredProductName} hangus karena pelunasan tidak dibayar dalam 3x24 jam sejak panen. Stok sudah kembali tersedia.`,
        type: 'preorder_expired',
        severity: 'danger',
        targetUrl: '/pre-order',
        metadata: { bookedOrderId: expiredBooking.id },
      });
    }
    return Boolean(expiredBooking);
  }

  private async processPreorderDepositStatus(
    midtransOrderId: string,
    transactionStatus: string,
    fraudStatus?: string,
    transactionId?: string,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let buyerNotification: { userId: number; title: string; message: string; severity: 'safe' | 'warning' | 'danger' } | null = null;
    let sellerNotification: { userId: number; title: string; message: string } | null = null;
    let lateDepositRefund: { bookingId: number; transactionId: string } | null = null;

    try {
      const booking = await queryRunner.manager.findOne(BookedOrder, {
        where: { depositMidtransOrderId: midtransOrderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!booking) {
        await queryRunner.commitTransaction();
        return { status: 'success' };
      }
      const bookingProduct = await queryRunner.manager.findOne(Product, {
        where: { id: booking.productId },
        relations: { shop: { user: true } },
      });
      if (!bookingProduct) throw new NotFoundException('Produk pre-order tidak ditemukan.');
      booking.product = bookingProduct;

      if (transactionId && !booking.depositMidtransTransactionId) {
        booking.depositMidtransTransactionId = transactionId;
      }

      const isPaid = transactionStatus === 'settlement' || (transactionStatus === 'capture' && fraudStatus === 'accept');
      const isFailed = ['cancel', 'deny', 'expire', 'failure'].includes(transactionStatus);
      if (booking.status !== bookedOrderStatus.WAITING_DEPOSIT || !bookingProduct.is_pre_order) {
        if (isPaid && booking.depositStatus !== 'paid') {
          const depositOrder = await queryRunner.manager.findOne(Order, {
            where: { midtransOrderId },
          });
          if (depositOrder) {
            depositOrder.status = orderStatus.CANCEL;
            depositOrder.midtransTransactionId = transactionId || depositOrder.midtransTransactionId;
            depositOrder.last_midtrans_webhook_status = transactionStatus;
            await queryRunner.manager.save(Order, depositOrder);
          }
          if (transactionId) {
            lateDepositRefund = { bookingId: booking.id, transactionId };
          } else {
            this.logger.error(`DP preorder booking #${booking.id} dibayar setelah tidak berlaku tetapi Midtrans tidak mengirim transaction_id; refund perlu ditindaklanjuti manual.`);
          }
        }
        if (booking.status === bookedOrderStatus.WAITING_DEPOSIT) {
          booking.status = bookedOrderStatus.EXPIRED;
          booking.depositStatus = isPaid ? 'expired' : (isFailed ? 'expired' : booking.depositStatus);
          booking.depositExpiresAt = null;
        }
        await queryRunner.manager.save(BookedOrder, booking);
        await queryRunner.commitTransaction();
        if (lateDepositRefund) {
          try {
            await this.coreApi.transaction.refund(lateDepositRefund.transactionId, {
              refund_key: `expired-preorder-deposit-${lateDepositRefund.bookingId}`,
            });
          } catch (error: any) {
            this.logger.error(`Gagal mengembalikan DP preorder yang dibayar setelah produk panen/booking kedaluwarsa (booking #${lateDepositRefund.bookingId}, transaction ${lateDepositRefund.transactionId}): ${error.message}`);
          }
        }
        return { status: 'success' };
      }

      const depositOrder = await this.createPreorderDepositOrder(
        queryRunner.manager,
        booking,
        booking.product,
        midtransOrderId,
      );
      if (transactionId) depositOrder.midtransTransactionId = transactionId;
      depositOrder.last_midtrans_webhook_status = transactionStatus;
      if (isPaid) depositOrder.status = orderStatus.PAID;
      else if (isFailed) depositOrder.status = orderStatus.CANCEL;
      await queryRunner.manager.save(Order, depositOrder);

      if (isPaid) {
        const product = await queryRunner.manager
          .createQueryBuilder(Product, 'product')
          .setLock('pessimistic_write')
          .where('product.id = :productId', { productId: booking.productId })
          .getOne();
        if (!product) throw new NotFoundException('Produk pre-order tidak ditemukan.');

        product.po_booked_kg += booking.quantity;
        await queryRunner.manager.save(Product, product);
        booking.depositStatus = 'paid';
        booking.status = product.is_pre_order ? bookedOrderStatus.BOOKED : bookedOrderStatus.HARVESTED;
        if (booking.status === bookedOrderStatus.HARVESTED) booking.harvestedAt ||= new Date();
        booking.depositExpiresAt = null;
        buyerNotification = {
          userId: booking.userId,
          title: 'DP pre-order berhasil dibayar',
          message: `DP 30% untuk ${booking.product.name} sudah diterima. Stok berhasil dikunci.`,
          severity: 'safe',
        };
        const sellerUserId = booking.product.shop?.user?.id;
        if (sellerUserId) {
          sellerNotification = {
            userId: sellerUserId,
            title: 'Pre-order dengan DP baru masuk',
            message: `DP 30% untuk pre-order ${booking.product.name} sudah dibayar.`,
          };
        }
      } else if (isFailed) {
        booking.depositStatus = transactionStatus === 'expire' ? 'expired' : 'failed';
        booking.status = transactionStatus === 'expire' ? bookedOrderStatus.EXPIRED : bookedOrderStatus.CANCELLED;
        booking.depositExpiresAt = null;
        buyerNotification = {
          userId: booking.userId,
          title: 'DP pre-order belum dibayar',
          message: `Pembayaran DP untuk ${booking.product.name} tidak berhasil. Tidak ada stok yang dikunci.`,
          severity: 'warning',
        };
      }

      await queryRunner.manager.save(BookedOrder, booking);
      await queryRunner.commitTransaction();

      if (buyerNotification) {
        await this.notificationService.createInAppNotification({
          ...buyerNotification,
          type: 'preorder_payment',
          targetUrl: '/pre-order',
          metadata: { bookedOrderId: booking.id },
        });
      }
      if (sellerNotification) {
        await this.notificationService.createInAppNotification({
          ...sellerNotification,
          type: 'preorder_booked',
          severity: 'warning',
          targetUrl: '/toko/pesanan',
          metadata: { bookedOrderId: booking.id },
        });
      }
      return { status: 'success' };
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async confirmBookedOrder(userId: number, bookedOrderId: number) {
    const bookedOrder = await this.bookedOrderRepo.findOne({
      where: { id: bookedOrderId, userId },
      relations: { product: true, user: true },
    });
    if (!bookedOrder) throw new NotFoundException('Pre-order tidak ditemukan.');
    if (bookedOrder.depositStatus !== 'paid') throw new BadRequestException('DP 30% harus berhasil dibayar sebelum menunggu panen.');
    if (bookedOrder.shippingMethod !== ShippingMethod.PICKUP) throw new BadRequestException('Pre-order hanya dapat diselesaikan dengan Pickup.');

    const paymentDeadline = bookedOrder.expiresAt?.getTime()
      ?? (bookedOrder.harvestedAt ? bookedOrder.harvestedAt.getTime() + 72 * 60 * 60 * 1000 : null);
    if (paymentDeadline !== null && paymentDeadline <= Date.now()) {
      await this.expireHarvestedBooking(bookedOrder.id);
      throw new BadRequestException('Tenggat pelunasan 3x24 jam sudah lewat. DP hangus dan stok telah dilepas.');
    }

    if (bookedOrder.status === bookedOrderStatus.PAYMENT_CREATED && bookedOrder.orderId) {
      const existingOrder = await this.orderRepo.findOne({ where: { id: bookedOrder.orderId } });
      return {
        message: 'Pembayaran pelunasan sudah dibuat.',
        orderId: bookedOrder.orderId,
        paymentURL: bookedOrder.balancePaymentUrl || existingOrder?.snap_redirect_url || null,
        paymentToken: null,
        depositAmount: bookedOrder.depositAmount,
        remainingAmount: bookedOrder.remainingAmount,
      };
    }
    if (bookedOrder.status !== bookedOrderStatus.HARVESTED) {
      throw new BadRequestException('Pelunasan tersedia setelah produk pre-order dipanen.');
    }
    if (bookedOrder.remainingAmount < 1) throw new BadRequestException('Sisa pelunasan tidak valid. Hubungi admin.');

    const midtransOrderId = `PO-BAL-${bookedOrder.id}-${randomUUID().replace(/-/g, '').slice(0, 8)}`;
    const transaction = await this.snap.createTransaction({
      transaction_details: { order_id: midtransOrderId, gross_amount: bookedOrder.remainingAmount },
      item_details: [{
        id: `balance-${bookedOrder.id}`,
        price: bookedOrder.remainingAmount,
        quantity: 1,
        name: `Pelunasan pre-order ${bookedOrder.product.name}`.substring(0, 50),
      }],
      credit_card: { secure: true },
      customer_details: {
        first_name: bookedOrder.recipientName,
        email: bookedOrder.user.email,
        phone: bookedOrder.recipientPhoneNumber,
      },
      expiry: { unit: 'day', duration: 1 },
      callbacks: { finish: `${this.frontendUrl}/pre-order` },
    });

    const order = await this.orderRepo.save(this.orderRepo.create({
      user: { id: userId },
      status: orderStatus.PENDING,
      total_price: bookedOrder.totalPrice,
      payment_amount: bookedOrder.remainingAmount,
      preorder_deposit_amount: bookedOrder.depositAmount,
      recipient_name: bookedOrder.recipientName,
      recipient_phone_number: bookedOrder.recipientPhoneNumber,
      recipient_address: bookedOrder.recipientAddress,
      shipping_method: ShippingMethod.PICKUP,
      midtransOrderId,
      snap_redirect_url: transaction.redirect_url,
      buyer_confirmed: false,
      seller_confirmed: false,
    }));
    await this.dataSource.manager.save(OrderItems, this.dataSource.manager.create(OrderItems, {
      quantity: bookedOrder.quantity,
      current_price: bookedOrder.product.price,
      product: { id: bookedOrder.productId },
      order: { id: order.id },
    }));

    bookedOrder.status = bookedOrderStatus.PAYMENT_CREATED;
    bookedOrder.orderId = order.id;
    bookedOrder.balancePaymentUrl = transaction.redirect_url;
    await this.bookedOrderRepo.save(bookedOrder);
    return {
      message: 'Pembayaran pelunasan berhasil dibuat.',
      orderId: order.id,
      paymentURL: transaction.redirect_url,
      paymentToken: transaction.token,
      totalPrice: bookedOrder.totalPrice,
      depositAmount: bookedOrder.depositAmount,
      remainingAmount: bookedOrder.remainingAmount,
    };
  }

  async cancelBookedOrder(userId: number, bookedOrderId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let sellerUserId: number | undefined;
    let cancelledBooking: BookedOrder | null = null;
    try {
      const bookedOrder = await queryRunner.manager.findOne(BookedOrder, {
        where: { id: bookedOrderId, userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!bookedOrder) throw new NotFoundException('Booked order tidak ditemukan');
      cancelledBooking = bookedOrder;
      if (bookedOrder.depositStatus !== 'paid') throw new BadRequestException('Pre-order hanya bisa dibatalkan setelah DP berhasil dibayar.');
      if (bookedOrder.status !== bookedOrderStatus.BOOKED && bookedOrder.status !== bookedOrderStatus.HARVESTED) {
        throw new BadRequestException('Booked order ini sudah tidak dapat dibatalkan.');
      }

      const productDetails = await queryRunner.manager.findOne(Product, {
        where: { id: bookedOrder.productId },
        relations: { shop: { user: true } },
      });
      if (!productDetails) throw new NotFoundException('Produk pre-order tidak ditemukan.');

      const product = await queryRunner.manager
        .createQueryBuilder(Product, 'product')
        .setLock('pessimistic_write')
        .where('product.id = :productId', { productId: bookedOrder.productId })
        .getOne();
      if (!product) throw new NotFoundException('Produk pre-order tidak ditemukan.');

      bookedOrder.status = bookedOrderStatus.CANCELLED;
      product.po_booked_kg = Math.max(0, product.po_booked_kg - bookedOrder.quantity);
      await queryRunner.manager.save(Product, product);
      await queryRunner.manager.save(BookedOrder, bookedOrder);
      bookedOrder.product = productDetails;
      sellerUserId = productDetails.shop?.user?.id;
      await queryRunner.commitTransaction();
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    if (sellerUserId && cancelledBooking) {
      await this.notificationService.createInAppNotification({
        userId: sellerUserId,
        title: 'Pre-order dibatalkan pembeli',
        message: `Pre-order ${cancelledBooking.product.name} sebanyak ${cancelledBooking.quantity} kg dibatalkan. Kuota/stok telah dilepas; DP tidak dikembalikan.`,
        type: 'preorder_cancelled',
        severity: 'warning',
        targetUrl: '/toko/pesanan',
        metadata: { bookedOrderId: cancelledBooking.id },
      });
    }
    return { message: 'Pre-order dibatalkan. DP 30% tidak dapat dikembalikan; kuota/stok panen telah dilepas.' };
  }

  async markProductHarvested(productId: number, harvestedAt = new Date()) {
    const bookedOrders = await this.bookedOrderRepo.find({
      where: { productId, status: In([bookedOrderStatus.BOOKED, bookedOrderStatus.WAITING_DEPOSIT]) },
      relations: { product: true },
    });
    for (const bookedOrder of bookedOrders) {
      if (bookedOrder.depositStatus === 'paid') {
        bookedOrder.status = bookedOrderStatus.HARVESTED;
        bookedOrder.harvestedAt = harvestedAt;
        bookedOrder.expiresAt = new Date(harvestedAt.getTime() + 72 * 60 * 60 * 1000);
      } else {
        bookedOrder.status = bookedOrderStatus.EXPIRED;
        bookedOrder.depositStatus = 'expired';
        bookedOrder.depositExpiresAt = null;
      }
      await this.bookedOrderRepo.save(bookedOrder);
      if (bookedOrder.depositStatus !== 'paid' && bookedOrder.orderId) {
        await this.orderRepo.update(
          { id: bookedOrder.orderId, status: In([orderStatus.PENDING, orderStatus.CHALLENGE]) },
          { status: orderStatus.CANCEL },
        );
      }
      await this.notificationService.createInAppNotification({
        userId: bookedOrder.userId,
        title: bookedOrder.depositStatus === 'paid' ? 'Pre-order sudah panen' : 'Pre-order sudah panen sebelum DP dibayar',
        message: bookedOrder.depositStatus === 'paid'
          ? `Produk ${bookedOrder.product.name} sudah dipanen. Lunasi dalam 3x24 jam agar stok tetap dikunci.`
          : `Produk ${bookedOrder.product.name} sudah dipanen sebelum DP dibayar. Booking DP dibatalkan; silakan pesan kembali dengan alur ready stock.`,
        type: 'preorder_harvested',
        severity: bookedOrder.depositStatus === 'paid' ? 'warning' : 'danger',
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
        if (notificationDto?.payment_type?.toLowerCase() === 'dana') {
          const transactionId = notificationDto?.transaction_id;
          if (!transactionId) throw new BadRequestException('Webhook DANA tidak memiliki transaction_id.');

          const baseUrl = this.isProduction
            ? 'https://api.midtrans.com'
            : 'https://api.sandbox.midtrans.com';
          const response = await axios.get(
            `${baseUrl}/v2/${encodeURIComponent(transactionId)}/status`,
            {
              auth: { username: this.midtransServerKey, password: '' },
              headers: { 'transaction-source': 'SNAP_API' },
            },
          );
          statusResponse = response.data;

          if (midtransOrderId && statusResponse?.order_id && statusResponse.order_id !== midtransOrderId) {
            throw new BadRequestException('Order ID webhook DANA tidak cocok dengan status transaksi Midtrans.');
          }
        } else {
          statusResponse = await this.snap.transaction.notification(notificationDto);
        }
      } catch (snapError: any) {
        this.logger.warn(
          `Verifikasi notifikasi Midtrans gagal (${snapError.message}). Payload webhook ditolak.`,
        );
        throw snapError;
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

      const verifiedOrderId = statusResponse?.order_id || midtransOrderId;
      if (typeof verifiedOrderId === 'string' && verifiedOrderId.startsWith('PO-DP-')) {
        return await this.processPreorderDepositStatus(
          verifiedOrderId,
          transactionStatus,
          fraudStatus,
          midtransTransactionId,
        );
      }

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
        const linkedBalanceBooking = order.midtransOrderId.startsWith('PO-BAL-')
          ? await queryRunner.manager.findOne(BookedOrder, {
              where: { orderId: order.id },
              lock: { mode: 'pessimistic_write' },
            })
          : null;
        if (linkedBalanceBooking?.status === bookedOrderStatus.EXPIRED && statusOrder === orderStatus.PAID) {
          await queryRunner.manager.update(Order, order.id, {
            status: orderStatus.CANCEL,
            midtransTransactionId: midtransTransactionId || order.midtransTransactionId,
          });
          await queryRunner.commitTransaction();
          const refundTransactionId = midtransTransactionId || order.midtransTransactionId;
          if (refundTransactionId) {
            try {
              await this.coreApi.transaction.refund(refundTransactionId, {
                refund_key: `expired-preorder-balance-${linkedBalanceBooking.id}`,
              });
            } catch (error: any) {
              this.logger.error(`Gagal mengembalikan pelunasan preorder yang masuk setelah tenggat (booking #${linkedBalanceBooking.id}, transaction ${refundTransactionId}): ${error.message}`);
            }
          } else {
            this.logger.error(`Pelunasan preorder booking #${linkedBalanceBooking.id} dibayar setelah stok dilepas tetapi transaction_id tidak tersedia; refund perlu ditindaklanjuti manual.`);
          }
          return { status: 'success' };
        }

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

          }
          this.logger.log(`Inventory deduction selesai untuk order #${order.id}`);
        }

        const balanceBooking = await queryRunner.manager.findOne(BookedOrder, {
          where: { orderId: order.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (balanceBooking?.status === bookedOrderStatus.PAYMENT_CREATED) {
          if (statusOrder === orderStatus.PAID) {
            balanceBooking.status = bookedOrderStatus.COMPLETED;
            balanceBooking.balancePaymentUrl = null;
            await queryRunner.manager.save(BookedOrder, balanceBooking);
          } else if (statusOrder === orderStatus.CANCEL) {
            balanceBooking.status = bookedOrderStatus.HARVESTED;
            balanceBooking.orderId = null;
            balanceBooking.balancePaymentUrl = null;
            await queryRunner.manager.save(BookedOrder, balanceBooking);
          }
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
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      throw new InternalServerErrorException(
        this.isProduction ? 'Gagal memproses webhook Midtrans.' : `Gagal memproses webhook Midtrans: ${message}`,
      );
    }
  }
}