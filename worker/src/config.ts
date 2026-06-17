import type { ProductConfig } from "./config";

export interface ProductConfig {
  name: string;
  model: string;
  searchQuery: string;
  maxPrice: number;
  kabumSearch: string;
  keywords: string[];
  excludeKeywords?: string[];
  amazonAsin?: string;
}

export const PRODUCTS: ProductConfig[] = [
  {
    name: "WD Green SN350 1TB",
    model: "WDS100T3G0C",
    searchQuery: "WD Green SN350 1TB",
    maxPrice: 850,
    kabumSearch: "wd sn350 1tb",
    keywords: ["sn350", "wd", "1tb"],
  },
  {
    name: "Kingston NV3 1TB",
    model: "SNV3S/1000G",
    searchQuery: "Kingston NV3 1TB",
    maxPrice: 900,
    kabumSearch: "kingston nv3 1tb",
    keywords: ["nv3", "kingston", "1tb"],
  },
  {
    name: "Crucial P3 1TB",
    model: "CT1000P3SSD8",
    searchQuery: "Crucial P3 1TB",
    maxPrice: 420,
    kabumSearch: "crucial p3 1tb",
    keywords: ["crucial", "p3", "1tb"],
    excludeKeywords: ["plus", "p3 plus", "p3+", "2tb", "4tb", "500gb", "480gb"],
  },
  {
    name: "WD Blue SN570 1TB",
    model: "WDS100T3G0G",
    searchQuery: "WD Blue SN570 1TB",
    maxPrice: 450,
    kabumSearch: "wd sn570 1tb",
    keywords: ["sn570", "wd", "1tb"],
    excludeKeywords: ["sn580", "sn350", "2tb", "500gb", "480gb"],
  },
];
