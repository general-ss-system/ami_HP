/**
 * 仮データを返す CmsClient。live の client.ts と同じ口を持つので、queries.ts は区別せずに使える。
 */

import type { CmsClient, ListQuery } from "./client";
import type { DeliveryEntry } from "./contracts";
import {
  fixtureAbout,
  fixtureContactForm,
  fixtureContactPage,
  fixtureHome,
  fixtureMembers,
  fixtureServices,
  fixtureSiteInfo,
  fixtureTopics,
} from "./fixtures";

const singletons: Record<string, DeliveryEntry> = {
  ami_home: fixtureHome,
  site_info: fixtureSiteInfo,
  about: fixtureAbout,
  contact_page: fixtureContactPage,
};
const collections: Record<string, DeliveryEntry[]> = {
  ami_services: fixtureServices,
  ami_topics: fixtureTopics,
  members: fixtureMembers,
};

function sortKey(entry: DeliveryEntry, key: string): string | number {
  if (key === "publishedAt" || key === "updatedAt") return entry[key];
  const v = entry.content[key];
  return typeof v === "number" || typeof v === "string" ? v : "";
}

function applyQuery(entries: DeliveryEntry[], query: ListQuery): DeliveryEntry[] {
  let result = entries.filter((e) =>
    Object.entries(query.filter ?? {}).every(([k, v]) => String(e.content[k]) === v),
  );
  const sort = query.sort ?? "-publishedAt";
  const desc = sort.startsWith("-");
  const key = desc ? sort.slice(1) : sort;
  result = [...result].sort((a, b) => {
    const x = sortKey(a, key);
    const y = sortKey(b, key);
    const c = x < y ? -1 : x > y ? 1 : 0;
    return desc ? -c : c;
  });
  const limit = query.limit ?? 20;
  const page = query.page ?? 1;
  return result.slice((page - 1) * limit, page * limit);
}

export function createFixtureClient(): CmsClient {
  return {
    async getSingleton(modelKey) {
      const e = singletons[modelKey];
      if (!e) throw new Error(`No fixture for singleton "${modelKey}"`);
      return e;
    },
    async getEntry(modelKey, slug) {
      return collections[modelKey]?.find((e) => e.slug === slug) ?? null;
    },
    async getForm(formKey) {
      if (formKey !== fixtureContactForm.key) throw new Error(`No fixture for form "${formKey}"`);
      return fixtureContactForm;
    },
    async getCollection(modelKey, query = {}) {
      const all = (collections[modelKey] ?? []).filter((e) =>
        Object.entries(query.filter ?? {}).every(([k, v]) => String(e.content[k]) === v),
      );
      const data = applyQuery(all, query);
      const limit = query.limit ?? 20;
      return {
        data,
        meta: {
          page: query.page ?? 1,
          limit,
          total: all.length,
          totalPages: Math.max(1, Math.ceil(all.length / limit)),
        },
      };
    },
  };
}
