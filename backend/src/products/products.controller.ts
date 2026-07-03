import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { IndexingService } from '../jobs/indexing.service';
import { ProductsService } from './products.service';
import {
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
} from './dto/product.dto';

@Controller()
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly indexing: IndexingService,
  ) {}

  @Roles(Role.ADMIN)
  @Post('admin/catalog/reindex')
  async reindex() {
    const reindexed = await this.indexing.reindexAll();
    return { reindexed };
  }

  @Public()
  @Get('products')
  findStorefront(@Query() query: ProductQueryDto) {
    return this.products.findManyForStorefront(query);
  }

  @Public()
  @Get('products/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.products.findBySlug(slug);
  }

  @Roles(Role.ADMIN)
  @Get('admin/products')
  findForAdmin(@Query() query: ProductQueryDto) {
    return this.products.findManyForAdmin(query);
  }

  @Roles(Role.ADMIN)
  @Get('admin/products/:id')
  findOneForAdmin(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.findOneForAdmin(id);
  }

  @Roles(Role.ADMIN)
  @Post('admin/products')
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch('admin/products/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete('admin/products/:id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.remove(id);
  }
}
