import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { DataSource, Repository } from 'typeorm';
import { roundMoney } from '../common/utils/money';
import { InventoryService } from '../inventory/inventory.service';
import { Product } from '../product/product.entity';
import { Supplier } from '../supplier/supplier.entity';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { PurchaseItem } from './purchase-item.entity';
import { Purchase } from './purchase.entity';

type UploadedReceiptFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class PurchaseService implements OnModuleInit {
  private readonly receiptDirectory = join(
    process.cwd(),
    'uploads',
    'purchase-receipts',
  );

  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepo: Repository<Purchase>,
    private readonly dataSource: DataSource,
    private readonly inventoryService: InventoryService,
  ) {}

  async onModuleInit() {
    await this.dataSource.query(`
      ALTER TABLE purchase
      ADD COLUMN IF NOT EXISTS transaction_currency varchar NOT NULL DEFAULT 'KWD'
    `);
    await this.dataSource.query(`
      ALTER TABLE purchase
      ADD COLUMN IF NOT EXISTS exchange_rate numeric(12, 6) NOT NULL DEFAULT 3.25
    `);
  }

  create(data: CreatePurchaseDto) {
    const transactionCurrency = data.transaction_currency ?? 'KWD';
    const exchangeRate = Number(data.exchange_rate ?? process.env.KWD_TO_USD_RATE ?? 3.25);

    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      throw new BadRequestException('Exchange rate must be greater than zero');
    }

    return this.dataSource.transaction(async (manager) => {
      const supplier = await manager
        .getRepository(Supplier)
        .findOne({ where: { id: data.supplier_id } });

      if (!supplier) {
        throw new NotFoundException('Supplier not found');
      }

      let total = 0;
      const calculatedItems = data.items.map((item) => {
        const costPerKg = roundMoney(
          transactionCurrency === 'USD'
            ? item.cost_per_kg / exchangeRate
            : item.cost_per_kg,
        );
        const amount = roundMoney(item.weight * costPerKg);
        total = roundMoney(total + amount);

        return {
          product_id: item.product_id,
          weight: roundMoney(item.weight),
          pieces: item.pieces ?? null,
          cost_per_kg: costPerKg,
          amount,
        };
      });

      for (const item of calculatedItems) {
        const product = await manager
          .getRepository(Product)
          .findOne({ where: { id: item.product_id } });

        if (!product) {
          throw new NotFoundException(`Product ${item.product_id} not found`);
        }
      }

      const date = new Date().toISOString();
      const purchase = await manager.getRepository(Purchase).save({
        supplier_id: data.supplier_id,
        invoice_no: data.invoice_no?.trim() || null,
        transaction_currency: transactionCurrency,
        exchange_rate: roundMoney(exchangeRate),
        date,
        total,
      });

      for (const item of calculatedItems) {
        await manager.getRepository(PurchaseItem).save({
          purchase_id: purchase.id,
          ...item,
        });

        await this.inventoryService.applyMovement(
          {
            product_id: item.product_id,
            type: 'purchase',
            quantity_kg: item.weight,
            reference_type: 'purchase',
            reference_id: purchase.id,
            date,
          },
          manager,
        );
      }

      supplier.balance = roundMoney(Number(supplier.balance) + total);
      await manager.getRepository(Supplier).save(supplier);

      return {
        message: 'Purchase recorded',
        purchase,
      };
    });
  }

  findAll() {
    return this.purchaseRepo.find({ order: { date: 'DESC', id: 'DESC' } });
  }

  async getPurchaseDetail(id: number) {
    const purchase = await this.getPurchaseById(id);
    const items = await this.getItemsByPurchase(id);

    return { ...purchase, items };
  }

  update(id: number, data: UpdatePurchaseDto) {
    const transactionCurrency = data.transaction_currency ?? 'KWD';
    const exchangeRate = Number(data.exchange_rate ?? process.env.KWD_TO_USD_RATE ?? 3.25);

    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      throw new BadRequestException('Exchange rate must be greater than zero');
    }

    return this.dataSource.transaction(async (manager) => {
      const purchaseRepo = manager.getRepository(Purchase);
      const itemRepo = manager.getRepository(PurchaseItem);
      const supplierRepo = manager.getRepository(Supplier);
      const productRepo = manager.getRepository(Product);

      const purchase = await purchaseRepo.findOne({ where: { id } });

      if (!purchase) {
        throw new NotFoundException('Purchase not found');
      }

      if (!data.supplier_id) {
        throw new BadRequestException('Supplier is required');
      }

      if (!data.items?.length) {
        throw new BadRequestException('At least one purchase item is required');
      }

      const [oldSupplier, nextSupplier, oldItems] = await Promise.all([
        supplierRepo.findOne({ where: { id: purchase.supplier_id } }),
        supplierRepo.findOne({ where: { id: data.supplier_id } }),
        itemRepo.find({ where: { purchase_id: id } }),
      ]);

      if (!oldSupplier) {
        throw new NotFoundException('Original supplier not found');
      }

      if (!nextSupplier) {
        throw new NotFoundException('Supplier not found');
      }

      let total = 0;
      const calculatedItems = data.items.map((item) => {
        const costPerKg = roundMoney(
          transactionCurrency === 'USD'
            ? item.cost_per_kg / exchangeRate
            : item.cost_per_kg,
        );
        const amount = roundMoney(item.weight * costPerKg);
        total = roundMoney(total + amount);

        return {
          product_id: item.product_id,
          weight: roundMoney(item.weight),
          pieces: item.pieces ?? null,
          cost_per_kg: costPerKg,
          amount,
        };
      });

      for (const item of calculatedItems) {
        const product = await productRepo.findOne({ where: { id: item.product_id } });

        if (!product) {
          throw new NotFoundException(`Product ${item.product_id} not found`);
        }
      }

      const editDate = new Date().toISOString();

      for (const oldItem of oldItems) {
        await this.inventoryService.applyMovement(
          {
            product_id: oldItem.product_id,
            type: 'adjustment',
            quantity_kg: -Number(oldItem.weight),
            reference_type: 'purchase_edit',
            reference_id: purchase.id,
            note: `Reverse purchase #${purchase.id} before edit`,
            date: editDate,
          },
          manager,
        );
      }

      await itemRepo.delete({ purchase_id: id });

      for (const item of calculatedItems) {
        await itemRepo.save({
          purchase_id: purchase.id,
          ...item,
        });

        await this.inventoryService.applyMovement(
          {
            product_id: item.product_id,
            type: 'purchase',
            quantity_kg: item.weight,
            reference_type: 'purchase_edit',
            reference_id: purchase.id,
            note: `Apply edited purchase #${purchase.id}`,
            date: editDate,
          },
          manager,
        );
      }

      if (oldSupplier.id === nextSupplier.id) {
        oldSupplier.balance = roundMoney(
          Number(oldSupplier.balance) - Number(purchase.total) + total,
        );
        await supplierRepo.save(oldSupplier);
      } else {
        oldSupplier.balance = roundMoney(Number(oldSupplier.balance) - Number(purchase.total));
        nextSupplier.balance = roundMoney(Number(nextSupplier.balance) + total);
        await supplierRepo.save([oldSupplier, nextSupplier]);
      }

      purchase.supplier_id = data.supplier_id;
      purchase.invoice_no = data.invoice_no?.trim() || null;
      purchase.transaction_currency = transactionCurrency;
      purchase.exchange_rate = roundMoney(exchangeRate);
      purchase.total = total;
      const savedPurchase = await purchaseRepo.save(purchase);

      return {
        message: 'Purchase updated',
        purchase: savedPurchase,
        items: await itemRepo.find({ where: { purchase_id: id } }),
      };
    });
  }

  async uploadReceipt(id: number, file: UploadedReceiptFile | undefined) {
    if (!file) {
      throw new BadRequestException('Receipt file is required');
    }

    const allowedMimeTypes = new Set([
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);

    if (!allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException(
        'Receipt must be a PDF, JPG, PNG, or WEBP file',
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Receipt file must be 10 MB or smaller');
    }

    const purchase = await this.getPurchaseById(id);
    await mkdir(this.receiptDirectory, { recursive: true });

    const extension = this.getSafeExtension(file);
    const fileName = `purchase-${id}-${Date.now()}${extension}`;
    await writeFile(join(this.receiptDirectory, fileName), file.buffer);

    purchase.receipt_original_name = file.originalname;
    purchase.receipt_file_name = fileName;
    purchase.receipt_mime_type = file.mimetype;
    purchase.receipt_size = file.size;
    purchase.receipt_uploaded_at = new Date().toISOString();

    return this.purchaseRepo.save(purchase);
  }

  async getPurchaseById(id: number) {
    const purchase = await this.purchaseRepo.findOne({ where: { id } });

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    return purchase;
  }

  async getReceiptFile(id: number) {
    const purchase = await this.getPurchaseById(id);

    if (!purchase.receipt_file_name) {
      throw new NotFoundException('Delivery receipt not found');
    }

    return {
      path: join(this.receiptDirectory, purchase.receipt_file_name),
      originalName:
        purchase.receipt_original_name ?? purchase.receipt_file_name,
      mimeType: purchase.receipt_mime_type ?? 'application/octet-stream',
    };
  }

  getItemsByPurchase(id: number) {
    return this.dataSource
      .getRepository(PurchaseItem)
      .find({ where: { purchase_id: id } });
  }

  async getSupplier(id: number) {
    const supplier = await this.dataSource
      .getRepository(Supplier)
      .findOne({ where: { id } });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  getProductsByIds(ids: number[]) {
    if (ids.length === 0) {
      return [];
    }

    return this.dataSource
      .getRepository(Product)
      .createQueryBuilder('product')
      .where('product.id IN (:...ids)', { ids })
      .getMany();
  }

  private getSafeExtension(file: UploadedReceiptFile) {
    const extension = extname(file.originalname).toLowerCase();

    if (['.pdf', '.jpg', '.jpeg', '.png', '.webp'].includes(extension)) {
      return extension;
    }

    if (file.mimetype === 'application/pdf') {
      return '.pdf';
    }

    if (file.mimetype === 'image/png') {
      return '.png';
    }

    if (file.mimetype === 'image/webp') {
      return '.webp';
    }

    return '.jpg';
  }
}
