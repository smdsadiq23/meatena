import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { roundMoney } from '../common/utils/money';
import { Product } from '../product/product.entity';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { StockMovement } from './stock-movement.entity';

type StockMovementInput = {
  product_id: number;
  type: StockMovement['type'];
  quantity_kg: number;
  reference_type?: string;
  reference_id?: number;
  note?: string;
  date?: string;
};

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(StockMovement)
    private readonly movementRepo: Repository<StockMovement>,
    private readonly dataSource: DataSource,
  ) {}

  async listStock() {
    const products = await this.productRepo.find({ order: { name: 'ASC' } });

    return products.map((product) => ({
      ...product,
      stock_kg: Number(product.stock_kg),
      low_stock_kg: Number(product.low_stock_kg),
      low_stock:
        Number(product.low_stock_kg) > 0 &&
        Number(product.stock_kg) <= Number(product.low_stock_kg),
    }));
  }

  async getSummary() {
    const stock = await this.listStock();

    let totalStockKg = 0;
    let estimatedRetailValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const lowStockItems = stock
      .filter((item) => {
        totalStockKg = roundMoney(totalStockKg + Number(item.stock_kg));
        estimatedRetailValue = roundMoney(
          estimatedRetailValue +
            Number(item.stock_kg) * Number(item.price_per_kg),
        );

        if (Number(item.stock_kg) <= 0) {
          outOfStockCount += 1;
        }

        if (item.low_stock) {
          lowStockCount += 1;
        }

        return item.low_stock;
      })
      .sort((a, b) => Number(a.stock_kg) - Number(b.stock_kg))
      .slice(0, 10);

    return {
      totals: {
        productCount: stock.length,
        totalStockKg,
        estimatedRetailValue,
        lowStockCount,
        outOfStockCount,
      },
      lowStockItems,
    };
  }

  async getReorderSuggestions() {
    const stock = await this.listStock();
    const suggestions = stock
      .filter(
        (item) =>
          Number(item.low_stock_kg) > 0 &&
          Number(item.stock_kg) <= Number(item.low_stock_kg),
      )
      .map((item) => {
        const stockKg = Number(item.stock_kg);
        const lowStockKg = Number(item.low_stock_kg);
        const targetStockKg = roundMoney(lowStockKg * 2);
        const suggestedPurchaseKg = roundMoney(
          Math.max(targetStockKg - stockKg, lowStockKg),
        );

        return {
          product_id: item.id,
          name: item.name,
          sku: item.sku,
          stock_kg: stockKg,
          low_stock_kg: lowStockKg,
          target_stock_kg: targetStockKg,
          suggested_purchase_kg: suggestedPurchaseKg,
          estimated_retail_value: roundMoney(
            suggestedPurchaseKg * Number(item.price_per_kg),
          ),
          priority: stockKg <= 0 ? 'out_of_stock' : 'low_stock',
        };
      })
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority === 'out_of_stock' ? -1 : 1;
        }

        return a.stock_kg - b.stock_kg;
      });

    return {
      totals: {
        suggestionCount: suggestions.length,
        suggestedPurchaseKg: suggestions.reduce(
          (sum, item) => roundMoney(sum + item.suggested_purchase_kg),
          0,
        ),
        estimatedRetailValue: suggestions.reduce(
          (sum, item) => roundMoney(sum + item.estimated_retail_value),
          0,
        ),
      },
      suggestions,
    };
  }

  listMovements() {
    return this.movementRepo.find({ order: { date: 'DESC', id: 'DESC' } });
  }

  async adjustStock(data: CreateStockAdjustmentDto): Promise<StockMovement> {
    const signedQuantity =
      data.type === 'wastage' ? -Math.abs(data.quantity_kg) : data.quantity_kg;

    return this.dataSource.transaction<StockMovement>((manager) => {
      return this.applyMovement(
        {
          product_id: data.product_id,
          type: data.type,
          quantity_kg: signedQuantity,
          note: data.note,
        },
        manager,
      );
    });
  }

  async applyMovement(
    data: StockMovementInput,
    manager?: EntityManager,
  ): Promise<StockMovement> {
    if (!manager) {
      return this.dataSource.transaction<StockMovement>((transactionManager) =>
        this.applyMovement(data, transactionManager),
      );
    }

    const productRepo = manager.getRepository(Product);
    const movementRepo = manager.getRepository(StockMovement);

    const product = await productRepo.findOne({
      where: { id: data.product_id },
      lock: { mode: 'pessimistic_write' },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const quantity = roundMoney(data.quantity_kg);
    const balanceAfter = roundMoney(Number(product.stock_kg) + quantity);

    if (balanceAfter < 0) {
      throw new BadRequestException(
        `Insufficient stock for ${product.name}. Available ${Number(product.stock_kg).toFixed(3)} kg.`,
      );
    }

    product.stock_kg = balanceAfter;
    await productRepo.save(product);

    return movementRepo.save({
      product_id: data.product_id,
      type: data.type,
      quantity_kg: quantity,
      balance_after_kg: balanceAfter,
      reference_type: data.reference_type,
      reference_id: data.reference_id,
      note: data.note,
      date: data.date ?? new Date().toISOString(),
    });
  }
}
