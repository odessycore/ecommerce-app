import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toSlug } from '../common/utils/slug';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug: toSlug(dto.name),
        description: dto.description,
        imageUrl: dto.imageUrl,
        parentId: dto.parentId,
        position: dto.position ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAllForAdmin() {
    return this.prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
  }

  async findActiveTree() {
    const categories = await this.prisma.category.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
    return this.buildTree(categories);
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
      include: { children: true },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id);
    const data: Prisma.CategoryUpdateInput = {
      description: dto.description,
      imageUrl: dto.imageUrl,
      position: dto.position,
      isActive: dto.isActive,
    };
    if (dto.name) {
      data.name = dto.name;
      data.slug = toSlug(dto.name);
    }
    if (dto.parentId !== undefined) {
      data.parent = dto.parentId
        ? { connect: { id: dto.parentId } }
        : { disconnect: true };
    }
    return this.prisma.category.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { message: 'Category archived' };
  }

  private buildTree(categories: { id: string; parentId: string | null }[]) {
    const byParent = new Map<string | null, typeof categories>();
    for (const category of categories) {
      const bucket = byParent.get(category.parentId) ?? [];
      bucket.push(category);
      byParent.set(category.parentId, bucket);
    }
    const attach = (parentId: string | null): unknown[] =>
      (byParent.get(parentId) ?? []).map((category) => ({
        ...category,
        children: attach(category.id),
      }));
    return attach(null);
  }
}
