import { cache } from "react";
import type { Dataset } from "../types";
import { loadLocalDataset } from "./local";
import { loadSupabaseDataset } from "./supabase";

export const dataMode = (): "local" | "supabase" =>
  process.env.DATA_SOURCE === "supabase" || (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.DATA_SOURCE !== "local") ? "supabase" : "local";

export const getDataset = cache(async (): Promise<Dataset> => (dataMode() === "supabase" ? loadSupabaseDataset() : loadLocalDataset()));
