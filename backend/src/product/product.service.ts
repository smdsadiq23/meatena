import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { roundMoney } from '../common/utils/money';
import { StockMovement } from '../inventory/stock-movement.entity';
import { InvoiceItem } from '../invoice/invoice-item.entity';
import { PurchaseItem } from '../purchase/purchase-item.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './product.entity';

@Injectable()
export class ProductService implements OnModuleInit {
  constructor(
    @InjectRepository(Product)
    private repo: Repository<Product>,

    @InjectRepository(InvoiceItem)
    private invoiceItemRepo: Repository<InvoiceItem>,

    @InjectRepository(PurchaseItem)
    private purchaseItemRepo: Repository<PurchaseItem>,

    @InjectRepository(StockMovement)
    private stockMovementRepo: Repository<StockMovement>,
  ) {}

  async onModuleInit() {
    await this.repo.query(`
      ALTER TABLE product
      ADD COLUMN IF NOT EXISTS name_ar varchar
    `);
  }

  create(data: CreateProductDto) {
    const product = this.repo.create({
      name: data.name.trim(),
      name_ar: data.name_ar?.trim() || null,
      sku: data.sku?.trim() || null,
      price_per_kg: roundMoney(data.price_per_kg ?? 0),
      low_stock_kg: roundMoney(data.low_stock_kg ?? 0),
    });
    return this.repo.save(product);
  }

  findAll() {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  findLowStock() {
    return this.repo
      .createQueryBuilder('product')
      .where('product.stock_kg <= product.low_stock_kg')
      .andWhere('product.low_stock_kg > 0')
      .orderBy('product.name', 'ASC')
      .getMany();
  }

  async update(id: number, data: UpdateProductDto) {
    const product = await this.repo.findOne({ where: { id } });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (data.name !== undefined) {
      product.name = data.name.trim();
    }

    if (data.name_ar !== undefined) {
      product.name_ar = data.name_ar.trim() || null;
    }

    if (data.sku !== undefined) {
      product.sku = data.sku.trim() || null;
    }

    if (data.price_per_kg !== undefined) {
      product.price_per_kg = roundMoney(data.price_per_kg);
    }

    if (data.low_stock_kg !== undefined) {
      product.low_stock_kg = roundMoney(data.low_stock_kg);
    }

    return this.repo.save(product);
  }

  async remove(id: number) {
    const product = await this.repo.findOne({ where: { id } });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const [invoiceItemCount, purchaseItemCount, stockMovementCount] =
      await Promise.all([
        this.invoiceItemRepo.count({ where: { product_id: id } }),
        this.purchaseItemRepo.count({ where: { product_id: id } }),
        this.stockMovementRepo.count({ where: { product_id: id } }),
      ]);

    if (
      Number(product.stock_kg) !== 0 ||
      invoiceItemCount > 0 ||
      purchaseItemCount > 0 ||
      stockMovementCount > 0
    ) {
      throw new BadRequestException(
        'Product has stock or transaction history. Keep it for reporting instead of deleting.',
      );
    }

    await this.repo.delete(id);

    return {
      message: `Product ${product.name} deleted successfully.`,
    };
  }
}
