import { registerAs } from '@nestjs/config';
import { CurrencyEnum } from '@zetik/common';
import * as env from 'env-var';

export const providerGamesConfig = registerAs(
  'providerGames',
  () =>
    ({
      signatureHeader: 'x-st8-sign',
      st8: {
        supportedCurrencies: [
          CurrencyEnum.MXN,
          CurrencyEnum.USD,
          CurrencyEnum.EUR,
          CurrencyEnum.BRL,
          CurrencyEnum.CAD,
          CurrencyEnum.DKK,
          CurrencyEnum.NZD,
          CurrencyEnum.ARS,
          CurrencyEnum.RUB,
        ] as const,
        apiUrl: env.get('ST8_API_URL').required().asString(),
        apiPublicKey: env.get('ST8_API_PUBLIC_KEY').required().asString(),
        localPrivateKey: env.get('ST8_LOCAL_PRIVATE_KEY').required().asString(),
        operatorCode: env.get('ST8_OPERATOR_CODE').required().asString(),
        operatorSiteCode: env.get('ST8_OPERATOR_SITE_CODE').required().asString(),
        operatorSite: env.get('ST8_OPERATOR_SITE').required().asString(),
        operatorSiteDepositUrl: env.get('ST8_OPERATOR_SITE_DEPOSIT_URL').required().asString(),
        assetsHost: env.get('ST8_ASSETS_HOST').required().asString(),
      },
      st8Asian: {
        supportedCurrencies: [
          CurrencyEnum.JPY,
          CurrencyEnum.IDR,
          CurrencyEnum.KRW,
          CurrencyEnum.INR,
          CurrencyEnum.PHP,
          CurrencyEnum.CNY,
          CurrencyEnum.VND,
        ] as const,
        apiUrl: env.get('ST8_ASIAN_API_URL').required().asString(),
        apiPublicKey: env.get('ST8_ASIAN_API_PUBLIC_KEY').required().asString(),
        localPrivateKey: env.get('ST8_ASIAN_LOCAL_PRIVATE_KEY').required().asString(),
        operatorCode: env.get('ST8_ASIAN_OPERATOR_CODE').required().asString(),
        operatorSiteCode: env.get('ST8_ASIAN_OPERATOR_SITE_CODE').required().asString(),
        operatorSite: env.get('ST8_ASIAN_OPERATOR_SITE').required().asString(),
        operatorSiteDepositUrl: env
          .get('ST8_ASIAN_OPERATOR_SITE_DEPOSIT_URL')
          .required()
          .asString(),
        assetsHost: env.get('ST8_ASIAN_ASSETS_HOST').required().asString(),
      },
    }) as const,
);
