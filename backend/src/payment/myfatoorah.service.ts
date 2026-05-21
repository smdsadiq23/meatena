import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type ExecutePaymentResponse = {
  Data?: {
    PaymentURL?: string;
    InvoiceId?: number;
  };
  IsSuccess?: boolean;
  Message?: string;
  ValidationErrors?: Array<{ Name?: string; Error?: string }>;
};

type PaymentDetailsResponse = {
  Data?: {
    Invoice?: {
      Status?: string;
      UserDefinedField?: string | null;
    };
    Transaction?: {
      Status?: string;
      PaymentId?: string;
      ReferenceId?: string;
      PaymentMethod?: string;
      Error?: {
        Message?: string;
      };
    };
    Customer?: {
      Reference?: string;
      Name?: string;
    };
    Amount?: {
      BaseCurrency?: string;
      ValueInBaseCurrency?: string;
      ValueInDisplayCurrency?: string;
    };
  };
  IsSuccess?: boolean;
  Message?: string;
};

export type VerifiedMyFatoorahPayment = {
  paymentId: string;
  referenceId?: string;
  customerReference?: string;
  customerName: string;
  amount: number;
  paymentMethod?: string;
  paymentMode: 'knet' | 'card';
  invoiceStatus?: string;
  transactionStatus?: string;
};

@Injectable()
export class MyFatoorahService {
  constructor(private readonly configService: ConfigService) {}

  getAvailability() {
    if (this.isMockMode()) {
      return {
        configured: true,
        missingKeys: [],
        mode: 'mock',
        message: 'Online payment mock gateway is enabled for local testing.',
      };
    }

    const requiredKeys = [
      'MYFATOORAH_API_TOKEN',
      'MYFATOORAH_BASE_URL',
      'MYFATOORAH_CALLBACK_URL',
      'MYFATOORAH_ERROR_URL',
    ];
    const missingKeys = requiredKeys.filter(
      (key) => !this.configService.get<string>(key),
    );

    return {
      configured: missingKeys.length === 0,
      missingKeys,
      mode: 'live',
      message:
        missingKeys.length === 0
          ? 'Online payment gateway is configured.'
          : `Online payment gateway is not configured. Missing: ${missingKeys.join(', ')}`,
    };
  }

  async createKnetPayment(params: {
    amount: number;
    customerName: string;
    invoiceReference: string;
  }) {
    return this.createPaymentLink({ ...params, method: 'knet' });
  }

  async createCardPayment(params: {
    amount: number;
    customerName: string;
    invoiceReference: string;
  }) {
    return this.createPaymentLink({ ...params, method: 'card' });
  }

  private async createPaymentLink(params: {
    amount: number;
    customerName: string;
    invoiceReference: string;
    method: 'knet' | 'card';
  }) {
    if (this.isMockMode()) {
      const paymentId = [
        'mock',
        params.method,
        params.invoiceReference,
        params.amount.toFixed(3),
        Date.now(),
      ].join('-');

      return {
        url: `${this.getPublicBaseUrl()}/payments/knet/mock-checkout?paymentId=${encodeURIComponent(paymentId)}`,
        invoiceId: Date.now(),
      };
    }

    const response = await this.request<ExecutePaymentResponse>(
      '/v2/ExecutePayment',
      {
        method: 'POST',
        body: JSON.stringify({
          InvoiceValue: params.amount,
          PaymentMethodId: this.getPaymentMethodId(params.method),
          CustomerName: params.customerName,
          CallBackUrl: this.requiredConfig('MYFATOORAH_CALLBACK_URL'),
          ErrorUrl: this.requiredConfig('MYFATOORAH_ERROR_URL'),
          DisplayCurrencyIso: 'KWD',
          Language: 'EN',
          CustomerReference: params.invoiceReference,
          UserDefinedField: `billing-${params.method}`,
        }),
      },
    );

    const paymentUrl = response.Data?.PaymentURL;

    if (!paymentUrl) {
      throw new BadGatewayException('MyFatoorah did not return a payment URL');
    }

    return {
      url: paymentUrl,
      invoiceId: response.Data?.InvoiceId,
    };
  }

  async verifyPayment(paymentId: string): Promise<VerifiedMyFatoorahPayment> {
    if (this.isMockPaymentId(paymentId)) {
      return this.verifyMockPayment(paymentId);
    }

    const response = await this.request<PaymentDetailsResponse>(
      `/v3/payments/${encodeURIComponent(paymentId)}`,
      {
        method: 'GET',
      },
    );

    const invoiceStatus = response.Data?.Invoice?.Status?.toUpperCase();
    const transactionStatus = response.Data?.Transaction?.Status?.toUpperCase();

    if (invoiceStatus !== 'PAID' || transactionStatus !== 'SUCCESS') {
      const errorMessage =
        response.Data?.Transaction?.Error?.Message ||
        response.Message ||
        'Payment is not successful';

      throw new BadGatewayException(errorMessage);
    }

    const customerReference = response.Data?.Customer?.Reference?.trim();
    const rawAmount =
      response.Data?.Amount?.ValueInBaseCurrency ??
      response.Data?.Amount?.ValueInDisplayCurrency;
    const amount = Number(rawAmount);

    if (!customerReference) {
      throw new BadGatewayException(
        'MyFatoorah payment is missing customer reference',
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadGatewayException('MyFatoorah payment amount is invalid');
    }

    return {
      paymentId,
      referenceId: response.Data?.Transaction?.ReferenceId,
      customerReference,
      customerName: response.Data?.Customer?.Name?.trim() || 'KNET Customer',
      amount,
      paymentMethod: response.Data?.Transaction?.PaymentMethod,
      paymentMode: this.resolvePaymentMode(
        response.Data?.Transaction?.PaymentMethod,
        response.Data?.Invoice?.UserDefinedField ?? undefined,
      ),
      invoiceStatus,
      transactionStatus,
    };
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const baseUrl = this.requiredConfig('MYFATOORAH_BASE_URL');
    const token = this.requiredConfig('MYFATOORAH_API_TOKEN');
    let response: Response;

    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
      });
    } catch {
      throw new BadGatewayException(
        'Could not reach MyFatoorah gateway. Check the API host and network connection.',
      );
    }

    const payload = (await response.json().catch(() => null)) as
      | (T & { Message?: string })
      | null;

    if (!response.ok) {
      throw new BadGatewayException(
        payload?.Message || `MyFatoorah request failed with ${response.status}`,
      );
    }

    if (!payload) {
      throw new BadGatewayException('Empty response from MyFatoorah');
    }

    return payload;
  }

  private requiredConfig(key: string) {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new ServiceUnavailableException(
        `KNET gateway is not configured. Missing required config: ${key}`,
      );
    }

    return value;
  }

  private getPaymentMethodId(method: 'knet' | 'card') {
    const key =
      method === 'card'
        ? 'MYFATOORAH_CARD_PAYMENT_METHOD_ID'
        : 'MYFATOORAH_KNET_PAYMENT_METHOD_ID';
    const fallback = method === 'card' ? 2 : 1;
    const configured = Number(this.configService.get<string>(key) ?? fallback);

    if (!Number.isInteger(configured) || configured <= 0) {
      throw new ServiceUnavailableException(
        `${key} must be a positive payment method id`,
      );
    }

    return configured;
  }

  private resolvePaymentMode(paymentMethod?: string, userDefinedField?: string) {
    const marker = `${userDefinedField ?? ''} ${paymentMethod ?? ''}`.toLowerCase();
    return marker.includes('knet') ? 'knet' : 'card';
  }

  private isMockMode() {
    return this.configService.get<string>('MYFATOORAH_MOCK') === 'true';
  }

  private isMockPaymentId(paymentId: string) {
    return paymentId.startsWith('mock-');
  }

  private verifyMockPayment(paymentId: string): VerifiedMyFatoorahPayment {
    const [, rawMethod, invoiceReference, rawAmount] = paymentId.split('-');
    const amount = Number(rawAmount);
    const paymentMode = rawMethod === 'card' ? 'card' : 'knet';

    if (!invoiceReference || !Number.isFinite(amount) || amount <= 0) {
      throw new BadGatewayException('Mock payment reference is invalid');
    }

    return {
      paymentId,
      referenceId: paymentId,
      customerReference: invoiceReference,
      customerName: paymentMode === 'card' ? 'Mock Card Customer' : 'Mock KNET Customer',
      amount,
      paymentMethod: paymentMode === 'card' ? 'CARD-MOCK' : 'KNET-MOCK',
      paymentMode,
      invoiceStatus: 'PAID',
      transactionStatus: 'SUCCESS',
    };
  }

  private getPublicBaseUrl() {
    return (
      this.configService.get<string>('KNET_PUBLIC_BASE_URL') ||
      `http://localhost:${this.configService.get<string>('PORT') || '3003'}`
    );
  }
}
