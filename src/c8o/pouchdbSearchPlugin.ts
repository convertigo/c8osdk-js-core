import { sha256 } from "js-sha256";

export interface C8oPouchDbSearchOptions {
    query?: string;
    q?: string;
    fields?: string[] | Record<string, number>;
    highlighting?: boolean;
    highlighting_pre?: string;
    highlighting_post?: string;
    include_docs?: boolean;
    limit?: number;
    skip?: number;
    mm?: string | number;
    build?: boolean;
    destroy?: boolean;
    stale?: string;
    language?: string | string[];
    filter?: (doc: any) => boolean;
}

interface FieldBoost {
    field: string;
    boost: number;
    path?: string[];
}

interface IndexedDoc {
    id: string;
    doc: any;
    fieldTexts: Record<string, string>;
    fieldTokens: Record<string, Map<string, number>>;
}

interface SearchIndex {
    fields: FieldBoost[];
    docs: Map<string, IndexedDoc>;
}

const indexCache = new WeakMap<any, Map<string, SearchIndex>>();

function getCacheForDb(db: any): Map<string, SearchIndex> {
    let cache = indexCache.get(db);
    if (!cache) {
        cache = new Map();
        indexCache.set(db, cache);
    }
    return cache;
}

function normalizeFields(fields: C8oPouchDbSearchOptions["fields"]): FieldBoost[] {
    if (Array.isArray(fields)) {
        return fields.map((field) => ({
            field,
            boost: 1,
            path: field.includes(".") ? field.split(".") : undefined
        }));
    }

    if (fields && typeof fields === "object") {
        return Object.keys(fields).map((field) => ({
            field,
            boost: typeof fields[field] === "number" ? fields[field] : 1,
            path: field.includes(".") ? field.split(".") : undefined
        }));
    }

    return [];
}

function extractText(fieldBoost: FieldBoost, doc: any): string | undefined {
    const path = fieldBoost.path;
    let value: any = doc;
    if (path) {
        for (let i = 0; i < path.length; i += 1) {
            if (Array.isArray(value)) {
                value = value.map((entry) => extractText({ field: fieldBoost.field, boost: fieldBoost.boost, path: path.slice(i) }, entry));
                break;
            }
            value = value?.[path[i]];
            if (value === undefined || value === null) {
                break;
            }
        }
    } else {
        value = doc?.[fieldBoost.field];
    }

    if (value === undefined || value === null) {
        return undefined;
    }

    if (Array.isArray(value)) {
        return value.map((item) => `${item ?? ""}`).join(" ");
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return `${value}`;
    }

    return value.toString ? value.toString() : undefined;
}

function tokenize(text: string): string[] {
    const matches = text.toLowerCase().match(/[\p{L}\p{N}]+/gu);
    return matches ?? [];
}

function countTokens(tokens: string[]): Map<string, number> {
    const counts = new Map<string, number>();
    tokens.forEach((token) => {
        counts.set(token, (counts.get(token) || 0) + 1);
    });
    return counts;
}

function parseMinMatch(mm: C8oPouchDbSearchOptions["mm"]): number {
    if (mm === undefined || mm === null) {
        return 1;
    }

    const asString = `${mm}`.trim();
    if (!asString) {
        return 1;
    }

    const parsed = parseFloat(asString.replace("%", ""));
    if (Number.isNaN(parsed)) {
        return 1;
    }
    return parsed / 100;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function buildIndex(db: any, fieldBoosts: FieldBoost[], filter?: (doc: any) => boolean): Promise<SearchIndex> {
    const result = await db.allDocs({ include_docs: true });
    const docs = new Map<string, IndexedDoc>();

    result.rows.forEach((row: any) => {
        const doc = row.doc;
        if (!doc || typeof doc !== "object") {
            return;
        }
        if (typeof doc._id === "string" && (doc._id.startsWith("_design/") || doc._id.startsWith("_local/"))) {
            return;
        }
        if (filter) {
            try {
                if (!filter(doc)) {
                    return;
                }
            } catch (_error) {
                return;
            }
        }

        const fieldTexts: Record<string, string> = {};
        const fieldTokens: Record<string, Map<string, number>> = {};
        fieldBoosts.forEach((fieldBoost) => {
            const text = extractText(fieldBoost, doc);
            if (text) {
                fieldTexts[fieldBoost.field] = text;
                fieldTokens[fieldBoost.field] = countTokens(tokenize(text));
            }
        });

        docs.set(row.id, {
            id: row.id,
            doc,
            fieldTexts,
            fieldTokens
        });
    });

    return {
        fields: fieldBoosts,
        docs
    };
}

function buildCacheKey(fieldBoosts: FieldBoost[], language: C8oPouchDbSearchOptions["language"], filter?: (doc: any) => boolean): string {
    const payload = {
        language: Array.isArray(language) ? language.join(",") : language || "en",
        fields: fieldBoosts.map((field) => field.field).sort(),
        filter: filter ? filter.toString() : ""
    };

    return sha256(JSON.stringify(payload));
}

export function registerPouchDbSearchPlugin(PouchDB: any): void {
    if (PouchDB?.prototype?.search) {
        return;
    }

    PouchDB.plugin({
        search: function search(options: C8oPouchDbSearchOptions = {}) {
            const query = options.query ?? options.q ?? "";
            const fieldBoosts = normalizeFields(options.fields);
            if (fieldBoosts.length === 0) {
                return Promise.resolve({ total_rows: 0, rows: [] });
            }

            const includeDocs = options.include_docs === true;
            const highlight = options.highlighting === true;
            const pre = options.highlighting_pre || "<strong>";
            const post = options.highlighting_post || "</strong>";
            const skip = typeof options.skip === "number" ? options.skip : 0;
            const limit = typeof options.limit === "number" ? options.limit : undefined;
            const minMatch = parseMinMatch(options.mm);
            const filter = options.filter;
            const cacheKey = buildCacheKey(fieldBoosts, options.language, filter);
            const cache = getCacheForDb(this);

            if (options.destroy) {
                cache.delete(cacheKey);
                return Promise.resolve({ ok: true });
            }

            const ensureIndex = async (): Promise<SearchIndex> => {
                const cached = cache.get(cacheKey);
                if (cached && options.stale === "ok") {
                    return cached;
                }
                const built = await buildIndex(this, fieldBoosts, filter);
                cache.set(cacheKey, built);
                return built;
            };

            if (options.build) {
                return ensureIndex().then(() => ({ ok: true }));
            }

            return ensureIndex().then((index) => {
                const queryTokens = Array.from(new Set(tokenize(`${query}`)));
                if (queryTokens.length === 0) {
                    return { total_rows: 0, rows: [] };
                }

                const rows: any[] = [];
                index.docs.forEach((docEntry) => {
                    const matchedTerms = new Set<string>();
                    let score = 0;

                    fieldBoosts.forEach((fieldBoost) => {
                        const counts = docEntry.fieldTokens[fieldBoost.field];
                        if (!counts) {
                            return;
                        }
                        queryTokens.forEach((term) => {
                            const count = counts.get(term);
                            if (count) {
                                matchedTerms.add(term);
                                score += count * fieldBoost.boost;
                            }
                        });
                    });

                    if (matchedTerms.size === 0) {
                        return;
                    }

                    if (queryTokens.length > 1) {
                        const ratio = matchedTerms.size / queryTokens.length;
                        if (Math.floor(ratio * 100) / 100 < minMatch) {
                            return;
                        }
                    }

                    const row: any = {
                        id: docEntry.id,
                        score
                    };

                    if (includeDocs) {
                        row.doc = docEntry.doc;
                    }

                    if (highlight) {
                        row.highlighting = {};
                        fieldBoosts.forEach((fieldBoost) => {
                            const text = docEntry.fieldTexts[fieldBoost.field];
                            if (!text) {
                                return;
                            }
                            let highlighted = text;
                            queryTokens.forEach((term) => {
                                const regex = new RegExp(`(${escapeRegExp(term)}[a-z]*)`, "gi");
                                highlighted = highlighted.replace(regex, `${pre}$1${post}`);
                            });
                            row.highlighting[fieldBoost.field] = highlighted;
                        });
                    }

                    rows.push(row);
                });

                rows.sort((a, b) => (a.score < b.score ? 1 : a.score > b.score ? -1 : 0));
                const totalRows = rows.length;
                const sliced = typeof limit === "number" && limit >= 0
                    ? rows.slice(skip, skip + limit)
                    : skip > 0
                        ? rows.slice(skip)
                        : rows;

                return {
                    total_rows: totalRows,
                    rows: sliced
                };
            });
        }
    });
}
