import {
  BabyIcon,
  BookOpenIcon,
  BriefcaseIcon,
  BusIcon,
  CarIcon,
  CatIcon,
  CircleEllipsisIcon,
  CoffeeIcon,
  CreditCardIcon,
  DogIcon,
  DumbbellIcon,
  FilmIcon,
  FuelIcon,
  Gamepad2Icon,
  GiftIcon,
  GraduationCapIcon,
  HeartPulseIcon,
  HouseIcon,
  LandmarkIcon,
  type LucideIcon,
  MusicIcon,
  PawPrintIcon,
  PiggyBankIcon,
  PillIcon,
  PizzaIcon,
  PlaneIcon,
  ReceiptIcon,
  RepeatIcon,
  ShirtIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  SmartphoneIcon,
  SparklesIcon,
  TagIcon,
  TrainIcon,
  UtensilsIcon,
  WifiIcon,
  WrenchIcon,
  ZapIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Icons a category can use, keyed by the kebab-case name stored in the database.
 * Imported explicitly (not looked up dynamically) so unused icons are tree-shaken.
 */
const ICONS: Record<string, LucideIcon> = {
  utensils: UtensilsIcon,
  "shopping-bag": ShoppingBagIcon,
  car: CarIcon,
  "shopping-cart": ShoppingCartIcon,
  receipt: ReceiptIcon,
  repeat: RepeatIcon,
  "circle-ellipsis": CircleEllipsisIcon,
  house: HouseIcon,
  zap: ZapIcon,
  wifi: WifiIcon,
  smartphone: SmartphoneIcon,
  coffee: CoffeeIcon,
  pizza: PizzaIcon,
  fuel: FuelIcon,
  bus: BusIcon,
  train: TrainIcon,
  plane: PlaneIcon,
  "heart-pulse": HeartPulseIcon,
  pill: PillIcon,
  dumbbell: DumbbellIcon,
  "graduation-cap": GraduationCapIcon,
  "book-open": BookOpenIcon,
  film: FilmIcon,
  music: MusicIcon,
  "gamepad-2": Gamepad2Icon,
  shirt: ShirtIcon,
  sparkles: SparklesIcon,
  gift: GiftIcon,
  baby: BabyIcon,
  dog: DogIcon,
  cat: CatIcon,
  "paw-print": PawPrintIcon,
  wrench: WrenchIcon,
  briefcase: BriefcaseIcon,
  landmark: LandmarkIcon,
  "piggy-bank": PiggyBankIcon,
  "credit-card": CreditCardIcon,
  tag: TagIcon,
};

export const CATEGORY_ICON_NAMES = Object.keys(ICONS);

export const CATEGORY_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
];

export function CategoryIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = ICONS[icon] ?? TagIcon;
  return <Icon className={className} aria-hidden />;
}

/** Icon in a tinted circle of the category's color. */
export function CategorySwatch({
  icon,
  color,
  className,
}: {
  icon: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full",
        className,
      )}
      style={{ backgroundColor: `${color}26`, color }}
    >
      <CategoryIcon icon={icon} className="size-4" />
    </span>
  );
}
