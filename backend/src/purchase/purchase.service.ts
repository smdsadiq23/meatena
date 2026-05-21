import {
  BadRequestException,
  Injectable,
  NotFoundException,
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
import { PurchaseItem } from './purchase-item.entity';
import { Purchase } from './purchase.entity';

type UploadedReceiptFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class PurchaseService {
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

  create(data: CreatePurchaseDto) {
    return this.dataSource.transaction(async (manager) => {
      const supplier = await manager
        .getRepository(Supplier)
        .findOne({ where: { id: data.supplier_id } });

      if (!supplier) {
        throw new NotFoundException('Supplier not found');
      }

      let total = 0;
      const calculatedItems = data.items.map((item) => {
        const amount = roundMoney(item.weight * item.cost_per_kg);
        total = roundMoney(total + amount);

        return {
          product_id: item.product_id,
          weight: roundMoney(item.weight),
          cost_per_kg: roundMoney(item.cost_per_kg),
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
