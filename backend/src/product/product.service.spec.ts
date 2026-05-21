import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StockMovement } from '../inventory/stock-movement.entity';
import { InvoiceItem } from '../invoice/invoice-item.entity';
import { PurchaseItem } from '../purchase/purchase-item.entity';
import { ProductService } from './product.service';
import { Product } from './product.entity';

describe('ProductService', () => {
  let service: ProductService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: getRepositoryToken(Product),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(InvoiceItem),
          useValue: { count: jest.fn() },
        },
        {
          provide: getRepositoryToken(PurchaseItem),
          useValue: { count: jest.fn() },
        },
        {
          provide: getRepositoryToken(StockMovement),
          useValue: { count: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
