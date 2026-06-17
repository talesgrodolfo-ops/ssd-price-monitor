export interface ProductConfig {
  name: string;
  model: string;
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
    maxPrice: 850,
    kabumSearch: "wd sn350 1tb",
    keywords: ["sn350", "1tb"],
  },
  {
    name: "Kingston NV3 1TB",
    model: "SNV3S/1000G",
    maxPrice: 900,
    kabumSearch: "kingston nv3 1tb",
    keywords: ["nv3", "snv3s", "1tb"],
  },
  {
    name: "Crucial P3 1TB",
    model: "CT1000P3SSD8",
    maxPrice: 420,
    kabumSearch: "crucial p3 1tb",
    keywords: ["crucial", "p3", "1tb"],
    excludeKeywords: ["plus", "2tb", "4tb", "500gb", "480gb"],
  },
  {
    name: "WD Blue SN570 1TB",
    model: "WDS100T3G0G",
    maxPrice: 450,
    kabumSearch: "wd sn570 1tb",
    keywords: ["sn570", "1tb"],
    excludeKeywords: ["2tb", "500gb", "480gb"],
  },
];
