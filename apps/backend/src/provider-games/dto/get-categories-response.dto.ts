import { ApiProperty } from '@nestjs/swagger';
import { ICategoryEntity } from '../interfaces/category.interface';

export interface IGetCategoriesResponse {
  categories: ICategoryEntity[];
}

export class GetCategoriesResponseDto implements IGetCategoriesResponse {
  @ApiProperty({ type: 'array', description: 'List of categories' })
  categories!: ICategoryEntity[];
}
