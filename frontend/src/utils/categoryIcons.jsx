import { 
  Utensils, Car, ShoppingBag, HeartPulse, Zap, Film, Briefcase, Laptop, TrendingUp, Package
} from 'lucide-react';

export const CATEGORY_ICONS = {
  'Food & Dining': Utensils,
  'Transport': Car,
  'Shopping': ShoppingBag,
  'Health': HeartPulse,
  'Bills & Utilities': Zap,
  'Entertainment': Film,
  'Salary': Briefcase,
  'Freelance': Laptop,
  'Investment': TrendingUp,
  'Other': Package,
};

export const getCategoryIcon = (category, size = 18) => {
  const Icon = CATEGORY_ICONS[category] || Package;
  return <Icon size={size} />;
};
