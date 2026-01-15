import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShop } from './useShop';
import { toast } from 'sonner';

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number;
  is_available: boolean;
  images: string[];
  category_id: string | null;
  shop_id: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
}

export function useProducts() {
  const { shop } = useShop();
  const queryClient = useQueryClient();

  const productsQuery = useQuery({
    queryKey: ['products', shop?.id],
    queryFn: async () => {
      if (!shop?.id) return [];
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!shop?.id,
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories', shop?.id],
    queryFn: async () => {
      if (!shop?.id) return [];
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('shop_id', shop.id)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as Category[];
    },
    enabled: !!shop?.id,
  });

  const createProduct = useMutation({
    mutationFn: async (product: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'shop_id'>) => {
      if (!shop?.id) throw new Error('No shop found');
      
      const { data, error } = await supabase
        .from('products')
        .insert({ ...product, shop_id: shop.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', shop?.id] });
      toast.success('Product created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create product: ${error.message}`);
    },
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Product> & { id: string }) => {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', shop?.id] });
      toast.success('Product updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update product: ${error.message}`);
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      // First, get the product to delete its images
      const { data: product } = await supabase
        .from('products')
        .select('images')
        .eq('id', id)
        .single();

      // Delete images from storage
      if (product?.images && product.images.length > 0) {
        const imagePaths = product.images.map((url: string) => {
          const path = url.split('/').pop();
          return `${shop?.id}/${path}`;
        }).filter(Boolean);
        
        if (imagePaths.length > 0) {
          await supabase.storage.from('product-images').remove(imagePaths);
        }
      }

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', shop?.id] });
      toast.success('Product deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete product: ${error.message}`);
    },
  });

  const uploadImage = async (file: File): Promise<string> => {
    if (!shop?.id) throw new Error('No shop found');
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${shop.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const deleteImage = async (url: string) => {
    if (!shop?.id) return;
    
    const fileName = url.split('/').pop();
    if (!fileName) return;

    await supabase.storage
      .from('product-images')
      .remove([`${shop.id}/${fileName}`]);
  };

  return {
    products: productsQuery.data ?? [],
    categories: categoriesQuery.data ?? [],
    isLoading: productsQuery.isLoading,
    isLoadingCategories: categoriesQuery.isLoading,
    createProduct,
    updateProduct,
    deleteProduct,
    uploadImage,
    deleteImage,
    refetch: productsQuery.refetch,
  };
}
