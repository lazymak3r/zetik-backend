import { AssetTypeEnum } from '@zetik/shared-entities';
import { validate } from 'class-validator';
import { GetDepositAddressDto } from './get-deposit-address.dto';

describe('GetDepositAddressDto', () => {
  it('should pass validation for BTC without network', async () => {
    const dto = new GetDepositAddressDto();
    dto.asset = AssetTypeEnum.BTC;

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should pass validation for USDC with valid network', async () => {
    const dto = new GetDepositAddressDto();
    dto.asset = AssetTypeEnum.USDC;
    dto.network = 'ethereum';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail validation for USDC without network', async () => {
    const dto = new GetDepositAddressDto();
    dto.asset = AssetTypeEnum.USDC;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isNetworkRequiredForAsset');
  });

  it('should fail validation for USDC with invalid network', async () => {
    const dto = new GetDepositAddressDto();
    dto.asset = AssetTypeEnum.USDC;
    dto.network = 'invalid-network';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isNetworkRequiredForAsset');
  });
});
