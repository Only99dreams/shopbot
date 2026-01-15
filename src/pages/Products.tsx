import { useState, useMemo } from 'react';
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Edit, Trash2, Package, Loader2, Eye, EyeOff } from "lucide-react";
import { useProducts, type Product } from "@/hooks/useProducts";
import { AddProductDialog } from "@/components/products/AddProductDialog";
import { EditProductDialog } from "@/components/products/EditProductDialog";
import { DeleteProductDialog } from "@/components/products/DeleteProductDialog";
import { Badge } from "@/components/ui/badge";

export default function Products() {
  const { products, categories, isLoading } = useProducts();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.description?.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || product.category_id === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, categoryFilter]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(price);
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Uncategorized';
    return categories.find(c => c.id === categoryId)?.name || 'Unknown';
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Products</h1>
            <p className="text-muted-foreground">Manage your product catalog</p>
          </div>
          <Button onClick={() => setAddOpen(true)} className="gradient-primary">
            <Plus className="h-5 w-5 mr-2" />
            Add Product
          </Button>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Search products..." 
              className="pl-10 h-11"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Package className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No products found</h3>
            <p className="text-muted-foreground mb-4">
              {products.length === 0 
                ? "Get started by adding your first product"
                : "Try adjusting your search or filter"
              }
            </p>
            {products.length === 0 && (
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="bg-card rounded-xl overflow-hidden shadow-card hover:shadow-lg transition-all duration-300 group border border-border"
              >
                {/* Product Image */}
                <div className="aspect-square bg-secondary/30 flex items-center justify-center relative overflow-hidden">
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <Package className="h-16 w-16 text-muted-foreground" />
                  )}
                  
                  {/* Availability Badge */}
                  <div className="absolute top-2 right-2">
                    {product.is_available ? (
                      <Badge className="bg-primary/90 text-primary-foreground">
                        <Eye className="h-3 w-3 mr-1" />
                        Visible
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-muted">
                        <EyeOff className="h-3 w-3 mr-1" />
                        Hidden
                      </Badge>
                    )}
                  </div>

                  {/* Discount Badge */}
                  {product.compare_at_price && product.compare_at_price > product.price && (
                    <div className="absolute top-2 left-2">
                      <Badge className="bg-destructive text-destructive-foreground">
                        -{Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100)}%
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="p-4">
                  <div className="mb-2">
                    <h3 className="font-semibold line-clamp-1">{product.name}</h3>
                    <p className="text-sm text-muted-foreground">{getCategoryName(product.category_id)}</p>
                  </div>
                  
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-lg font-bold text-primary">{formatPrice(product.price)}</p>
                      {product.compare_at_price && product.compare_at_price > product.price && (
                        <p className="text-sm text-muted-foreground line-through">
                          {formatPrice(product.compare_at_price)}
                        </p>
                      )}
                    </div>
                    <p className={`text-sm font-medium ${product.stock_quantity < 10 ? "text-destructive" : "text-muted-foreground"}`}>
                      {product.stock_quantity} in stock
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => setEditProduct(product)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => setDeleteProduct(product)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AddProductDialog 
        open={addOpen} 
        onOpenChange={setAddOpen} 
        categories={categories}
      />
      <EditProductDialog 
        open={!!editProduct} 
        onOpenChange={(open) => !open && setEditProduct(null)} 
        product={editProduct}
        categories={categories}
      />
      <DeleteProductDialog 
        open={!!deleteProduct} 
        onOpenChange={(open) => !open && setDeleteProduct(null)} 
        product={deleteProduct}
      />
    </DashboardLayout>
  );
}
