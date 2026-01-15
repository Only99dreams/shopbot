import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Edit2, 
  Trash2,
  FolderOpen,
  Loader2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/useShop";
import { useToast } from "@/hooks/use-toast";

interface Category {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
}

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    sort_order: "0"
  });

  const { shop } = useShop();
  const { toast } = useToast();

  useEffect(() => {
    if (shop) {
      fetchCategories();
    }
  }, [shop]);

  const fetchCategories = async () => {
    if (!shop) return;
    
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('shop_id', shop.id)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error);
    } else {
      setCategories(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;

    setSaving(true);

    const categoryData = {
      shop_id: shop.id,
      name: formData.name,
      description: formData.description || null,
      sort_order: parseInt(formData.sort_order) || 0
    };

    let error;
    if (editingCategory) {
      const result = await supabase
        .from('categories')
        .update(categoryData)
        .eq('id', editingCategory.id);
      error = result.error;
    } else {
      const result = await supabase
        .from('categories')
        .insert(categoryData);
      error = result.error;
    }

    setSaving(false);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: editingCategory ? "Category updated" : "Category added",
        description: `${formData.name} has been ${editingCategory ? 'updated' : 'added'} successfully.`
      });
      setIsDialogOpen(false);
      resetForm();
      fetchCategories();
    }
  };

  const handleDelete = async (category: Category) => {
    if (!confirm(`Are you sure you want to delete "${category.name}"?`)) return;

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', category.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Category deleted",
        description: `${category.name} has been deleted.`
      });
      fetchCategories();
    }
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || "",
      sort_order: category.sort_order.toString()
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingCategory(null);
    setFormData({
      name: "",
      description: "",
      sort_order: "0"
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Categories</h1>
            <p className="text-muted-foreground">Organize your products into categories</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingCategory ? 'Edit Category' : 'Add New Category'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Category Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sort_order">Sort Order</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData(prev => ({ ...prev, sort_order: e.target.value }))}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingCategory ? 'Update Category' : 'Add Category')}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Categories List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : categories.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">No categories yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create categories to organize your products.
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Name</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Description</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Order</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="p-4 font-medium">{category.name}</td>
                    <td className="p-4 text-muted-foreground text-sm">{category.description || '-'}</td>
                    <td className="p-4">{category.sort_order}</td>
                    <td className="p-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(category)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(category)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
