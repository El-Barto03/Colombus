import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const shops = sqliteTable("shops", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull().default("shop"),
  initials: text("initials").notNull(),
  logo: text("logo").notNull().default(""),
  logoText: text("logo_text").notNull().default(""),
  logoBackground: text("logo_background").notNull().default("light"),
  type: text("type").notNull().default(""),
  productRange: text("product_range").notNull().default(""),
  priceRange: text("price_range").notNull().default(""),
  contact: text("contact").notNull().default(""),
  fit: text("fit").notNull().default(""),
  address: text("address").notNull(),
  neighborhood: text("neighborhood").notNull().default(""),
  website: text("website").notNull().default(""),
  directionsUrl: text("directions_url").notNull().default(""),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  note: text("note").notNull().default(""),
  visitStatus: text("visit_status").notNull().default("not_visited"),
  reachOutSent: integer("reach_out_sent", { mode: "boolean" }).notNull().default(false),
  followupSent: integer("followup_sent", { mode: "boolean" }).notNull().default(false),
  manualNotes: text("manual_notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const appState = sqliteTable("app_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
