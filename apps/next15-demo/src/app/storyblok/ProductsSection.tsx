import { storyblokEditable } from "@storyblok/react";
import type { ProductsSection } from "@/lib/types";
import { useMemo } from "react";
import Headline from "../components/Headline";
import Lead from "../components/Lead";
import Product from "../components/Product";
import getGridClasses from "@/lib/getGridClasses";

interface ProductsSectionComponentProps {
  blok: ProductsSection;
  index?: number;
}

export default function ProductsSectionComponent({
  blok,
  index,
}: ProductsSectionComponentProps) {
  const gridClasses = useMemo(() => getGridClasses(), []);

  console.log(blok);
  return (
    <section
      {...storyblokEditable(blok)}
      className="page-section products-section bg-primary-background"
    >
      <div className="container">
        <div className="text-center">
          {blok.headline && <Headline headline={blok.headline} index={index} />}
          {blok.lead && <Lead>{blok.lead}</Lead>}
        </div>
        <div
          className={[
            gridClasses,
            { "lg:!mt-0": !blok.headline && !blok.lead },
          ].join(" ")}
          style={{ placeItems: "center" }}
        >
          {(blok.plugin as any).items.map((product: { id: number }) => {
            return (
              <Product
                key={product.id}
                product={{ id: product.id.toString() }}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
