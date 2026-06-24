import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { roundMoney } from '../common/utils/money';
import { Invoice } from '../invoice/invoice.entity';
import { InvoiceItem } from '../invoice/invoice-item.entity';
import { Product } from '../product/product.entity';
import { PurchaseItem } from '../purchase/purchase-item.entity';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { UpdateStockMovementDto } from './dto/update-stock-movement.dto';
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
    @InjectRepository(PurchaseItem)
    private readonly purchaseItemRepo: Repository<PurchaseItem>,
    @InjectRepository(InvoiceItem)
    private readonly invoiceItemRepo: Repository<InvoiceItem>,
    private readonly dataSource: DataSource,
  ) {}

  async listStock() {
    const products = await this.productRepo.find({ order: { name: 'ASC' } });
    const [purchasedPieces, soldPieces] = await Promise.all([
      this.purchaseItemRepo
        .createQueryBuilder('item')
        .select('item.product_id', 'product_id')
        .addSelect('COALESCE(SUM(item.pieces), 0)', 'pieces')
        .groupBy('item.product_id')
        .getRawMany<{ product_id: number | string; pieces: string }>(),
      this.invoiceItemRepo
        .createQueryBuilder('item')
        .innerJoin(Invoice, 'invoice', 'invoice.id = item.invoice_id')
        .select('item.product_id', 'product_id')
        .addSelect('COALESCE(SUM(item.pieces), 0)', 'pieces')
        .where('item.product_id IS NOT NULL')
        .andWhere("invoice.status != 'void'")
        .groupBy('item.product_id')
        .getRawMany<{ product_id: number | string; pieces: string }>(),
    ]);
    const purchasedPiecesByProduct = new Map(
      purchasedPieces.map((item) => [
        Number(item.product_id),
        Number(item.pieces),
      ]),
    );
    const soldPiecesByProduct = new Map(
      soldPieces.map((item) => [Number(item.product_id), Number(item.pieces)]),
    );

    return products.map((product) => ({
      ...product,
      stock_kg: Number(product.stock_kg),
      stock_pieces:
        (purchasedPiecesByProduct.get(product.id) ?? 0) -
        (soldPiecesByProduct.get(product.id) ?? 0),
      low_stock_kg: Number(product.low_stock_kg),
      low_stock:
        Number(product.low_stock_kg) > 0 &&
        Number(product.stock_kg) <= Number(product.low_stock_kg),
    }));
  }

  async getSummary() {
    const stock = await this.listStock();

    let totalStockKg = 0;
    let totalStockPieces = 0;
    let estimatedRetailValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const lowStockItems = stock
      .filter((item) => {
        totalStockKg = roundMoney(totalStockKg + Number(item.stock_kg));
        totalStockPieces += Number(item.stock_pieces ?? 0);
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
        totalStockPieces,
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

  async updateMovement(
    id: number,
    data: UpdateStockMovementDto,
  ): Promise<StockMovement> {
    return this.dataSource.transaction<StockMovement>(async (manager) => {
      const movementRepo = manager.getRepository(StockMovement);
      const productRepo = manager.getRepository(Product);
      const movement = await movementRepo.findOne({ where: { id } });

      if (!movement) {
        throw new NotFoundException('Stock movement not found');
      }

      const oldProductId = movement.product_id;

      if (data.product_id !== undefined && data.product_id !== movement.product_id) {
        const product = await productRepo.findOne({
          where: { id: data.product_id },
        });

        if (!product) {
          throw new NotFoundException('Product not found');
        }

        movement.product_id = data.product_id;
      }

      if (data.type !== undefined) {
        movement.type = data.type;
      }

      if (data.quantity_kg !== undefined) {
        movement.quantity_kg = this.normalizeMovementQuantity(
          movement.type,
          data.quantity_kg,
        );
      } else {
        movement.quantity_kg = this.normalizeMovementQuantity(
          movement.type,
          Number(movement.quantity_kg),
        );
      }

      if (data.note !== undefined) {
        movement.note = data.note.trim() || null;
      }

      if (data.date !== undefined) {
        movement.date = data.date;
      }

      await movementRepo.save(movement);
      await this.recalculateProductStock(oldProductId, manager);

      if (movement.product_id !== oldProductId) {
        await this.recalculateProductStock(movement.product_id, manager);
      }

      const updated = await movementRepo.findOne({ where: { id } });

      if (!updated) {
        throw new NotFoundException('Stock movement not found');
      }

      return updated;
    });
  }

  async deleteMovement(id: number) {
    return this.dataSource.transaction(async (manager) => {
      const movementRepo = manager.getRepository(StockMovement);
      const movement = await movementRepo.findOne({ where: { id } });

      if (!movement) {
        throw new NotFoundException('Stock movement not found');
      }

      await movementRepo.delete(id);
      await this.recalculateProductStock(movement.product_id, manager);

      return {
        message: `Stock movement #${id} deleted successfully.`,
      };
    });
  }

  async reverseMovement(id: number, reason?: string): Promise<StockMovement> {
    return this.dataSource.transaction<StockMovement>(async (manager) => {
      const movementRepo = manager.getRepository(StockMovement);
      const movement = await movementRepo.findOne({ where: { id } });

      if (!movement) {
        throw new NotFoundException('Stock movement not found');
      }

      const existingReversal = await movementRepo.findOne({
        where: {
          reference_type: 'stock_movement_reversal',
          reference_id: movement.id,
        },
      });

      if (existingReversal) {
        throw new BadRequestException('This stock movement is already reversed');
      }

      const reversalNote = [
        `Reversal of ${movement.type} movement #${movement.id}`,
        reason?.trim(),
      ]
        .filter(Boolean)
        .join(' - ');

      return this.applyMovement(
        {
          product_id: movement.product_id,
          type: 'adjustment',
          quantity_kg: -Number(movement.quantity_kg),
          reference_type: 'stock_movement_reversal',
          reference_id: movement.id,
          note: reversalNote,
        },
        manager,
      );
    });
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

  private normalizeMovementQuantity(
    type: StockMovement['type'],
    quantityKg: number,
  ) {
    const quantity = roundMoney(quantityKg);

    if (type === 'sale' || type === 'wastage') {
      return -Math.abs(quantity);
    }

    if (type === 'purchase') {
      return Math.abs(quantity);
    }

    return quantity;
  }

  private async recalculateProductStock(
    productId: number,
    manager: EntityManager,
  ) {
    const productRepo = manager.getRepository(Product);
    const movementRepo = manager.getRepository(StockMovement);
    const product = await productRepo.findOne({
      where: { id: productId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const movements = await movementRepo.find({
      where: { product_id: productId },
      order: { date: 'ASC', id: 'ASC' },
    });
    let balance = 0;

    for (const movement of movements) {
      balance = roundMoney(balance + Number(movement.quantity_kg));

      if (balance < 0) {
        throw new BadRequestException(
          `This change would make ${product.name} stock negative on ${movement.date}.`,
        );
      }

      movement.balance_after_kg = balance;
    }

    if (movements.length) {
      await movementRepo.save(movements);
    }

    product.stock_kg = balance;
    await productRepo.save(product);
  }
}
