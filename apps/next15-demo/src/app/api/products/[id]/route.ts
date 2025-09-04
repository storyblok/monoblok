import { NextRequest, NextResponse } from 'next/server';

const products = [
  {
    id: 1,
    sku: 'SB-HOODIE-BLK-001',
    name: 'Black Hoodie',
    slug: 'black-hoodie',
    type: 'product',
    image: 'https://a.storyblok.com/f/285661493291234/1024x1536/6f3be21d7d/storyblok-hoody-black.png',
    description: 'A comfortable black hoodie with a minimalist Storyblok logo—perfect for everyday wear.',
    price: 49.99,
    currency: 'USD',
    available: true,
  },
  {
    id: 2,
    sku: 'SB-TSHIRT-WHT-001',
    name: 'White T-Shirt',
    slug: 'white-t-shirt',
    type: 'product',
    image: 'https://a.storyblok.com/f/285661493291234/1024x1024/1a1e8ef5ab/storyblok-t-shirt-white.png',
    description: 'A classic white t-shirt featuring a subtle Storyblok print. Soft, breathable, and perfect for layering.',
    price: 39.99,
    currency: 'USD',
    available: true,
  },
  {
    id: 3,
    sku: 'SB-CAP-001',
    name: 'Logo Cap',
    slug: 'logo-cap',
    type: 'product',
    image: 'https://a.storyblok.com/f/285661493291234/1024x1024/127931921d/storyblok-cap.png',
    description: 'A stylish, adjustable cap with the Storyblok logo embroidered on the front. Great for sun n style.',
    price: 19.99,
    currency: 'USD',
    available: false,
  },
  {
    id: 4,
    sku: 'SB-MUG-001',
    name: 'Storyblok Mug',
    slug: 'storyblok-mug',
    type: 'product',
    image: 'https://a.storyblok.com/f/285661493291234/1024x1024/25074958e0/storyblok-mug-white.png',
    description: 'A ceramic mug for your morning coffee, featuring the Storyblok logo in a clean, bold design.',
    price: 9.99,
    currency: 'USD',
    available: false,
  },
  {
    id: 5,
    sku: 'SB-SOCKS-001',
    name: 'Cozy Socks',
    type: 'product',
    slug: 'cozy-socks',
    image: 'https://a.storyblok.com/f/285661493291234/1024x1024/ba9fa248e2/storyblok-socks-white.png',
    description: 'Warm and soft socks with subtle branding—ideal for lounging or working from home in comfort.',
    price: 4.99,
    currency: 'USD',
    available: true,
  },
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = products.find(p => p.id === parseInt(id));

  if (!product) {
    return NextResponse.json(
      { error: 'Product not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(product);
}
