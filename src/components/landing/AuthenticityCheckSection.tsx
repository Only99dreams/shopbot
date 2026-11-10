import { ProductAuthenticityChecker } from "@/components/products/ProductAuthenticityChecker";

export function AuthenticityCheckSection() {
  return (
    <section className="py-16 lg:py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl rounded-3xl border bg-muted/30 px-6 py-10 text-center sm:px-12 sm:py-14">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
            Check if a product is real
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Snap a photo of the pack, including the NAFDAC number, and we will compare it against
            the official NAFDAC Greenbook before you buy. Works on products from any shop, not just
            ShopAfrica.
          </p>
          <div className="mt-6 flex justify-center">
            <ProductAuthenticityChecker label="Check a product with a photo" size="lg" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No account needed. Your photo is checked and discarded, never stored.
          </p>
        </div>
      </div>
    </section>
  );
}
