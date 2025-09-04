"use client";
import { useState, useEffect } from "react";

interface ProductProps {
  product: {
    id: string;
  };
}

interface FetchedProduct {
  id: string;
  name: string;
  description: string;
  image: string;
  price: number;
  currency: string;
  available: boolean;
}

export default function Product({ product }: ProductProps) {
  const [fetchedProduct, setFetchedProduct] = useState<FetchedProduct | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // In a real-world scenario, you would fetch product details from a store API.
    const fetchProduct = async () => {
      try {
        const response = await fetch(`/api/products/${product.id}`);
        if (!response.ok) {
          throw new Error("Product not found");
        }
        const data = await response.json();
        setFetchedProduct(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch product"
        );
      }
    };

    fetchProduct();
  }, [product.id]);

  if (error) {
    return <div>Product not found.</div>;
  }

  if (!fetchedProduct) {
    return <div>Loading...</div>;
  }

  return (
    <div className="relative flex size-full max-w-sm grow flex-col overflow-hidden rounded-lg bg-white lg:max-w-none">
      {fetchedProduct.image && (
        <img
          src={fetchedProduct.image}
          alt={fetchedProduct.name}
          className="aspect-square object-cover"
        />
      )}
      <div className="p-6">
        {fetchedProduct.name && (
          <h3 className="mb-3 font-display text-xl font-black">
            {fetchedProduct.name}
          </h3>
        )}
        {fetchedProduct.description && (
          <p className="leading-relaxed">{fetchedProduct.description}</p>
        )}
        <div className="mt-4 text-lg font-semibold">
          {fetchedProduct.available &&
          fetchedProduct.price &&
          fetchedProduct.currency ? (
            <span>
              {fetchedProduct.price} {fetchedProduct.currency}
            </span>
          ) : (
            <span className="text-pink-700">Sold out</span>
          )}
        </div>
      </div>
    </div>
  );
}
