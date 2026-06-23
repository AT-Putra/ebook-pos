import type { Prisma } from '@prisma/client';
import { salesStatus } from './programs';

export type ProgramWithRelations = Prisma.ProductGetPayload<{
  include: { attachments: true; _count: { select: { orders: true } } };
}>;

/** Serializes a program (Product + attachments + computed sale status) for the dashboard. */
export function serializeProgram(p: ProgramWithRelations) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    programName: p.programName,
    description: p.description,
    linkMessageTemplate: p.linkMessageTemplate,
    priceIdr: p.priceIdr,
    isActive: p.isActive,
    fileName: p.fileName,
    salesStartAt: p.salesStartAt,
    salesEndAt: p.salesEndAt,
    salesStatus: salesStatus(p),
    orderCount: p._count.orders,
    attachments: [...p.attachments]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(a => ({ id: a.id, fileName: a.fileName, sortOrder: a.sortOrder })),
  };
}
