export interface VariantAxis {
  type: 'size' | 'color' | 'one';
  values: string[];
}

export interface ProductSeed {
  name: string;
  brand: string;
  description: string;
  attributes: Record<string, unknown>;
  basePrice: number;
  compareAtPrice?: number;
  imageCount: number;
  axis: VariantAxis;
}

export interface SubcategorySeed {
  name: string;
  products: ProductSeed[];
}

export interface CategorySeed {
  name: string;
  description: string;
  children: SubcategorySeed[];
}

const sizes = (...values: string[]): VariantAxis => ({ type: 'size', values });
const colors = (...values: string[]): VariantAxis => ({ type: 'color', values });
const oneSize: VariantAxis = { type: 'one', values: ['One Size'] };

export const CATALOG: CategorySeed[] = [
  {
    name: 'Apparel',
    description: 'Considered essentials and outerwear.',
    children: [
      {
        name: 'Tops',
        products: [
          {
            name: 'Essential Cotton Tee',
            brand: 'Acme',
            description: 'A midweight organic-cotton tee with a clean, boxy fit.',
            attributes: { material: 'organic cotton', fit: 'relaxed', care: 'machine wash cold' },
            basePrice: 3500,
            imageCount: 3,
            axis: sizes('XS', 'S', 'M', 'L', 'XL'),
          },
          {
            name: 'Heavyweight Pocket Tee',
            brand: 'Acme',
            description: 'Structured 240gsm jersey with a reinforced chest pocket.',
            attributes: { material: 'cotton', weight: '240gsm', fit: 'regular' },
            basePrice: 4500,
            compareAtPrice: 5500,
            imageCount: 2,
            axis: sizes('S', 'M', 'L', 'XL'),
          },
          {
            name: 'Merino Crew Knit',
            brand: 'Northbound',
            description: 'Fine-gauge extra-fine merino wool crewneck.',
            attributes: { material: 'merino wool', season: 'autumn/winter' },
            basePrice: 9800,
            imageCount: 2,
            axis: sizes('S', 'M', 'L', 'XL'),
          },
        ],
      },
      {
        name: 'Outerwear',
        products: [
          {
            name: 'Wool Overcoat',
            brand: 'Northbound',
            description: 'Tailored double-faced wool overcoat with a notch lapel.',
            attributes: { material: 'wool blend', lining: 'cupro', fit: 'tailored' },
            basePrice: 32000,
            imageCount: 3,
            axis: sizes('S', 'M', 'L', 'XL'),
          },
          {
            name: 'Quilted Bomber Jacket',
            brand: 'Acme',
            description: 'Lightweight diamond-quilted bomber with a ribbed collar.',
            attributes: { material: 'recycled nylon', insulation: 'primaloft' },
            basePrice: 18000,
            compareAtPrice: 21000,
            imageCount: 2,
            axis: sizes('S', 'M', 'L', 'XL'),
          },
        ],
      },
    ],
  },
  {
    name: 'Footwear',
    description: 'Everyday sneakers and seasonal boots.',
    children: [
      {
        name: 'Sneakers',
        products: [
          {
            name: 'Court Low Sneaker',
            brand: 'Stride',
            description: 'Minimal full-grain leather court sneaker on a cupsole.',
            attributes: { material: 'leather', sole: 'rubber cupsole' },
            basePrice: 12000,
            imageCount: 3,
            axis: sizes('8', '9', '10', '11', '12'),
          },
          {
            name: 'Runner Knit',
            brand: 'Stride',
            description: 'Engineered-knit runner with a responsive foam midsole.',
            attributes: { material: 'engineered knit', drop: '8mm' },
            basePrice: 14000,
            imageCount: 2,
            axis: sizes('8', '9', '10', '11', '12'),
          },
        ],
      },
      {
        name: 'Boots',
        products: [
          {
            name: 'Chelsea Leather Boot',
            brand: 'Northbound',
            description: 'Goodyear-welted chelsea boot in oiled suede.',
            attributes: { material: 'suede', construction: 'goodyear welt' },
            basePrice: 24000,
            imageCount: 3,
            axis: sizes('8', '9', '10', '11'),
          },
        ],
      },
    ],
  },
  {
    name: 'Accessories',
    description: 'Bags, hats and finishing touches.',
    children: [
      {
        name: 'Bags',
        products: [
          {
            name: 'Leather Weekender',
            brand: 'Carryall',
            description: 'Vegetable-tanned leather holdall with a suede-lined interior.',
            attributes: { material: 'vegetable-tanned leather', capacity: '38L' },
            basePrice: 29000,
            imageCount: 3,
            axis: colors('Black', 'Tan'),
          },
          {
            name: 'Canvas Field Tote',
            brand: 'Carryall',
            description: 'Waxed-canvas tote with leather handles and a zip pocket.',
            attributes: { material: 'waxed canvas', capacity: '20L' },
            basePrice: 6000,
            imageCount: 2,
            axis: colors('Charcoal', 'Olive', 'Sand'),
          },
        ],
      },
      {
        name: 'Hats',
        products: [
          {
            name: 'Ribbed Wool Beanie',
            brand: 'Acme',
            description: 'Chunky ribbed beanie in lambswool.',
            attributes: { material: 'lambswool' },
            basePrice: 4000,
            imageCount: 1,
            axis: colors('Black', 'Grey', 'Forest'),
          },
          {
            name: 'Six-Panel Cap',
            brand: 'Acme',
            description: 'Unstructured washed-twill cap with an adjustable strap.',
            attributes: { material: 'cotton twill' },
            basePrice: 3500,
            imageCount: 1,
            axis: oneSize,
          },
        ],
      },
    ],
  },
];

export type CustomerKind = 'credential' | 'google' | 'invited';

export interface CustomerSeed {
  firstName: string;
  lastName: string;
  kind: CustomerKind;
  city: string;
  region: string;
  country: string;
}

export const CUSTOMERS: CustomerSeed[] = [
  { firstName: 'Olivia', lastName: 'Bennett', kind: 'credential', city: 'Brooklyn', region: 'NY', country: 'US' },
  { firstName: 'Liam', lastName: 'Carter', kind: 'credential', city: 'Austin', region: 'TX', country: 'US' },
  { firstName: 'Sophia', lastName: 'Nguyen', kind: 'google', city: 'San Jose', region: 'CA', country: 'US' },
  { firstName: 'Noah', lastName: 'Patel', kind: 'credential', city: 'Chicago', region: 'IL', country: 'US' },
  { firstName: 'Emma', lastName: 'Rodriguez', kind: 'credential', city: 'Denver', region: 'CO', country: 'US' },
  { firstName: 'James', lastName: 'O’Connor', kind: 'google', city: 'Boston', region: 'MA', country: 'US' },
  { firstName: 'Ava', lastName: 'Thompson', kind: 'credential', city: 'Seattle', region: 'WA', country: 'US' },
  { firstName: 'William', lastName: 'Hughes', kind: 'credential', city: 'Portland', region: 'OR', country: 'US' },
  { firstName: 'Isabella', lastName: 'Rossi', kind: 'invited', city: 'Miami', region: 'FL', country: 'US' },
  { firstName: 'Ethan', lastName: 'Walsh', kind: 'invited', city: 'Nashville', region: 'TN', country: 'US' },
];

export const STREETS = [
  '120 Greenpoint Ave',
  '48 Larkspur Lane',
  '900 Cedar Street',
  '17 Marlow Court',
  '231 Harbor View',
  '64 Sutton Place',
  '512 Birchwood Rd',
  '8 Kingfisher Way',
];

export const REVIEW_TITLES = [
  'Exactly as described',
  'Beautiful quality',
  'My new favourite',
  'Worth every penny',
  'Great everyday piece',
  'Fits perfectly',
];

export const REVIEW_BODIES = [
  'The material feels premium and the fit is spot on. Would buy again.',
  'Shipping was quick and the craftsmanship is excellent.',
  'Even better in person — the details are really considered.',
  'Held up well after a few washes, no complaints at all.',
  'Comfortable from day one and looks sharp.',
];
