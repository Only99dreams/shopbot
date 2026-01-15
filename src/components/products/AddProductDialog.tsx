import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useProducts, type Category } from '@/hooks/useProducts';
import { Upload, X, Loader2, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';

interface AddProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
}

export function AddProductDialog({ open, onOpenChange, categories }: AddProductDialogProps) {
  const { createProduct, uploadImage } = useProducts();
  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    compare_at_price: '',
    stock_quantity: '',
    category_id: '',
    is_available: true,
  });

  const handleImageUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setUploadingImages(true);
    try {
      const uploadPromises = Array.from(files).map(file => uploadImage(file));
      const urls = await Promise.all(uploadPromises);
      setImages(prev => [...prev, ...urls]);
      toast.success(`${files.length} image(s) uploaded`);
    } catch (error: any) {
      toast.error(`Failed to upload images: ${error.message}`);
    } finally {
      setUploadingImages(false);
    }
  }, [uploadImage]);

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    
    if (!formData.price || parseFloat(formData.price) <= 0) {
      toast.error('Valid price is required');
      return;
    }

    setLoading(true);
    try {
      await createProduct.mutateAsync({
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: parseFloat(formData.price),
        compare_at_price: formData.compare_at_price ? parseFloat(formData.compare_at_price) : null,
        stock_quantity: formData.stock_quantity ? parseInt(formData.stock_quantity) : 0,
        category_id: formData.category_id || null,
        is_available: formData.is_available,
        images,
      });
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        price: '',
        compare_at_price: '',
        stock_quantity: '',
        category_id: '',
        is_available: true,
      });
      setImages([]);
      onOpenChange(false);
    } catch (error) {
      // Error handled in hook
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Add New Product</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Image Upload */}
          <div className="space-y-3">
            <Label>Product Images</Label>
            <div className="flex flex-wrap gap-3">
              {images.map((url, index) => (
                <div key={index} className="relative group">
                  <img
                    src={url}
                    alt={`Product ${index + 1}`}
                    className="w-24 h-24 object-cover rounded-lg border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              
              <label className="w-24 h-24 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleImageUpload(e.target.files)}
                  disabled={uploadingImages}
                />
                {uploadingImages ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <ImagePlus className="h-6 w-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground mt-1">Add</span>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Product Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Classic White Tee"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe your product..."
              rows={3}
            />
          </div>

          {/* Price Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price (₦) *</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="compare_at_price">Compare at Price (₦)</Label>
              <Input
                id="compare_at_price"
                type="number"
                min="0"
                step="0.01"
                value={formData.compare_at_price}
                onChange={(e) => setFormData(prev => ({ ...prev, compare_at_price: e.target.value }))}
                placeholder="Original price"
              />
            </div>
          </div>

          {/* Stock & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stock">Stock Quantity</Label>
              <Input
                id="stock"
                type="number"
                min="0"
                value={formData.stock_quantity}
                onChange={(e) => setFormData(prev => ({ ...prev, stock_quantity: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Availability */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <Label htmlFor="available" className="text-base">Available for sale</Label>
              <p className="text-sm text-muted-foreground">Show this product on your storefront</p>
            </div>
            <Switch
              id="available"
              checked={formData.is_available}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_available: checked }))}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || uploadingImages}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Product
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
