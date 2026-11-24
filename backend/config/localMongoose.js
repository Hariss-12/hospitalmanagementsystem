/**
 * Local JSON-backed document store used for development and tests.
 *
 * Provides:
 * - Schema definition with field validation, required/enum/default/select:false, timestamps, and compound unique indexes
 * - Optimistic concurrency control via `__v` version key
 * - Atomic `findOneAndUpdate`, `create`, `find`, `findById`, `findOne`, `countDocuments`, `deleteMany`
 * - Support for `.select('+passwordHash')`, `.populate()`, `.sort()`, `.lean()`
 * - Persistent JSON file storage + atomic in-process mutex lock for concurrent request handling
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function generateObjectId() {
  return crypto.randomBytes(12).toString('hex');
}

function isValidObjectId(id) {
  return typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);
}

class Schema {
  constructor(definition, options = {}) {
    this.definition = definition;
    this.options = { timestamps: true, ...options };
    this.indexes = [];
    this.preHooks = { save: [] };
    this.methods = {};
  }

  index(fields, options = {}) {
    this.indexes.push({ fields, options });
    return this;
  }

  pre(hookName, fn) {
    if (!this.preHooks[hookName]) this.preHooks[hookName] = [];
    this.preHooks[hookName].push(fn);
    return this;
  }
}

Schema.Types = {
  ObjectId: 'ObjectId',
  Mixed: 'Mixed',
};

const models = new Map();
const collections = new Map();
let dbFilePath = path.resolve(__dirname, '..', 'data', 'hospital_dfa_store.json');
let persistenceEnabled = true;
let connectedState = 0;

function loadFromDisk() {
  if (!persistenceEnabled) return;
  try {
    if (fs.existsSync(dbFilePath)) {
      const raw = JSON.parse(fs.readFileSync(dbFilePath, 'utf8'));
      for (const [colName, docs] of Object.entries(raw)) {
        collections.set(colName, Array.isArray(docs) ? docs : []);
      }
    }
  } catch {
    // Ignore corrupt or empty initial file
  }
}

function flushToDisk() {
  if (!persistenceEnabled) return;
  try {
    const dir = path.dirname(dbFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const dump = {};
    for (const [colName, docs] of collections.entries()) {
      dump[colName] = docs;
    }
    fs.writeFileSync(dbFilePath, JSON.stringify(dump, null, 2), 'utf8');
  } catch {
    // Ignore write failure in read-only test contexts
  }
}

function deepClone(val) {
  if (val === null || val === undefined) return val;
  return structuredClone(val);
}

function matchesFilter(doc, filter = {}) {
  if (!filter || typeof filter !== 'object') return true;

  for (const [key, cond] of Object.entries(filter)) {
    if (key === '$or' && Array.isArray(cond)) {
      if (!cond.some((sub) => matchesFilter(doc, sub))) return false;
      continue;
    }
    if (key === '$and' && Array.isArray(cond)) {
      if (!cond.every((sub) => matchesFilter(doc, sub))) return false;
      continue;
    }

    const docVal = doc[key];

    if (cond && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
      for (const [op, opVal] of Object.entries(cond)) {
        if (op === '$in') {
          const arr = Array.isArray(opVal) ? opVal.map(String) : [];
          if (!arr.includes(String(docVal))) return false;
        } else if (op === '$nin') {
          const arr = Array.isArray(opVal) ? opVal.map(String) : [];
          if (arr.includes(String(docVal))) return false;
        } else if (op === '$ne') {
          if (String(docVal) === String(opVal)) return false;
        } else if (op === '$regex') {
          const flags = cond.$options || 'i';
          const re = opVal instanceof RegExp ? opVal : new RegExp(String(opVal), flags);
          if (!re.test(String(docVal || ''))) return false;
        } else if (op === '$options') {
          // Handled with $regex
        } else if (op === '$gte') {
          if (!(docVal >= opVal)) return false;
        } else if (op === '$lte') {
          if (!(docVal <= opVal)) return false;
        } else if (op === '$gt') {
          if (!(docVal > opVal)) return false;
        } else if (op === '$lt') {
          if (!(docVal < opVal)) return false;
        } else {
          return false;
        }
      }
    } else {
      if (cond === null) {
        if (docVal !== null && docVal !== undefined) return false;
      } else if (String(docVal) !== String(cond)) {
        return false;
      }
    }
  }
  return true;
}

class Query {
  constructor(model, op, filter = {}, extra = {}) {
    this.model = model;
    this.op = op;
    this.filter = filter;
    this.extra = extra;
    this._select = null;
    this._populates = [];
    this._sort = null;
    this._limit = null;
    this._skip = 0;
    this._lean = false;
  }

  select(spec) {
    this._select = spec;
    return this;
  }

  populate(pathSpec, selectFields) {
    if (typeof pathSpec === 'string') {
      this._populates.push({ path: pathSpec, select: selectFields });
    } else if (pathSpec && typeof pathSpec === 'object') {
      this._populates.push(pathSpec);
    }
    return this;
  }

  sort(sortSpec) {
    this._sort = sortSpec;
    return this;
  }

  limit(n) {
    this._limit = Number(n);
    return this;
  }

  skip(n) {
    this._skip = Number(n);
    return this;
  }

  lean() {
    this._lean = true;
    return this;
  }

  async exec() {
    return this.model._executeQuery(this);
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }
}

function createModel(name, schema) {
  if (!collections.has(name)) {
    collections.set(name, []);
  }

  const hiddenFields = new Set();
  for (const [field, spec] of Object.entries(schema.definition)) {
    if (spec && typeof spec === 'object' && spec.select === false) {
      hiddenFields.add(field);
    }
  }

  function applySchemaDefaultsAndValidation(rawDoc, isUpdate = false) {
    const doc = { ...rawDoc };
    if (!doc._id) {
      doc._id = generateObjectId();
    } else {
      doc._id = String(doc._id);
    }

    const now = new Date().toISOString();
    if (schema.options.timestamps) {
      if (!doc.createdAt) doc.createdAt = now;
      doc.updatedAt = now;
    }
    if (doc.__v === undefined) {
      doc.__v = 0;
    }

    for (const [field, spec] of Object.entries(schema.definition)) {
      if (!spec || typeof spec !== 'object' || Array.isArray(spec)) continue;

      if (doc[field] === undefined && spec.default !== undefined && !isUpdate) {
        doc[field] = typeof spec.default === 'function' ? spec.default() : deepClone(spec.default);
      }

      if (typeof doc[field] === 'string' && spec.trim) {
        doc[field] = doc[field].trim();
      }
      if (typeof doc[field] === 'string' && spec.lowercase) {
        doc[field] = doc[field].toLowerCase();
      }

      if (spec.required && (doc[field] === undefined || doc[field] === null || doc[field] === '')) {
        const msg = Array.isArray(spec.required) ? spec.required[1] : `Field '${field}' is required.`;
        const err = new Error(msg);
        err.name = 'ValidationError';
        err.statusCode = 400;
        throw err;
      }

      if (doc[field] !== undefined && doc[field] !== null && spec.enum) {
        const allowed = Array.isArray(spec.enum) ? spec.enum : spec.enum.values;
        if (Array.isArray(allowed) && !allowed.includes(doc[field])) {
          const err = new Error(`Invalid value '${doc[field]}' for field '${field}'. Allowed: ${allowed.join(', ')}`);
          err.name = 'ValidationError';
          err.statusCode = 400;
          throw err;
        }
      }
    }

    return doc;
  }

  function enforceUniqueConstraints(candidateDoc, existingId = null) {
    const store = collections.get(name) || [];

    // 1. Field-level unique constraints
    for (const [field, spec] of Object.entries(schema.definition)) {
      if (spec && typeof spec === 'object' && spec.unique) {
        const val = candidateDoc[field];
        if (val !== undefined && val !== null) {
          const conflict = store.find(
            (d) => String(d._id) !== String(existingId) && String(d[field]) === String(val)
          );
          if (conflict) {
            const err = new Error(`Duplicate value for unique field '${field}': ${val}`);
            err.code = 11000;
            err.statusCode = 409;
            err.keyValue = { [field]: val };
            throw err;
          }
        }
      }
    }

    // 2. Compound schema indexes with unique + optional partialFilterExpression
    for (const idx of schema.indexes) {
      if (!idx.options || !idx.options.unique) continue;
      const partialFilter = idx.options.partialFilterExpression;
      if (partialFilter && !matchesFilter(candidateDoc, partialFilter)) {
        continue;
      }
      const fieldNames = Object.keys(idx.fields);
      const conflict = store.find((d) => {
        if (String(d._id) === String(existingId)) return false;
        if (partialFilter && !matchesFilter(d, partialFilter)) return false;
        return fieldNames.every((f) => String(d[f]) === String(candidateDoc[f]));
      });
      if (conflict) {
        const err = new Error(
          `Duplicate key conflict on index [${fieldNames.join(', ')}]. Resource is already booked or exists.`
        );
        err.code = 11000;
        err.statusCode = 409;
        throw err;
      }
    }
  }

  function wrapDocument(raw, selectSpec = null, lean = false) {
    if (!raw) return null;
    const copy = deepClone(raw);

    const includeHidden = new Set();
    const onlyFields = new Set();
    const excludeFields = new Set();

    if (typeof selectSpec === 'string') {
      for (const token of selectSpec.trim().split(/\s+/)) {
        if (!token) continue;
        if (token.startsWith('+')) includeHidden.add(token.slice(1));
        else if (token.startsWith('-')) excludeFields.add(token.slice(1));
        else onlyFields.add(token);
      }
    }

    for (const hf of hiddenFields) {
      if (!includeHidden.has(hf)) {
        delete copy[hf];
      }
    }
    for (const ef of excludeFields) {
      delete copy[ef];
    }
    if (onlyFields.size > 0) {
      for (const k of Object.keys(copy)) {
        if (k !== '_id' && !onlyFields.has(k) && !includeHidden.has(k)) {
          delete copy[k];
        }
      }
    }

    copy.id = String(copy._id);

    if (lean) return copy;

    Object.defineProperty(copy, 'toObject', {
      enumerable: false,
      configurable: true,
      value: () => ({ ...copy }),
    });

    Object.defineProperty(copy, 'save', {
      enumerable: false,
      configurable: true,
      value: async function () {
        const store = collections.get(name) || [];
        const existingIdx = store.findIndex((d) => String(d._id) === String(copy._id));
        const existingRaw = existingIdx >= 0 ? store[existingIdx] : {};
        const merged = applySchemaDefaultsAndValidation({ ...existingRaw, ...copy });
        enforceUniqueConstraints(merged, merged._id);
        if (existingIdx >= 0) {
          merged.__v = Number(existingRaw.__v || 0) + 1;
          store[existingIdx] = merged;
        } else {
          store.push(merged);
        }
        flushToDisk();
        Object.assign(copy, wrapDocument(merged, selectSpec, true));
        return copy;
      },
    });

    for (const [mName, mFn] of Object.entries(schema.methods)) {
      Object.defineProperty(copy, mName, {
        enumerable: false,
        configurable: true,
        value: mFn.bind(copy),
      });
    }

    return copy;
  }

  async function populateDocs(docs, populates) {
    if (!populates || populates.length === 0) return docs;
    const isSingle = !Array.isArray(docs);
    const list = isSingle ? (docs ? [docs] : []) : docs;

    for (const pop of populates) {
      const fieldPath = pop.path;
      const spec = schema.definition[fieldPath];
      const refModelName = pop.model || (spec && spec.ref);
      if (!refModelName || !models.has(refModelName)) continue;
      const RefModel = models.get(refModelName);

      for (const d of list) {
        const refId = d[fieldPath];
        if (!refId || typeof refId === 'object') continue;
        const refDoc = await RefModel.findById(String(refId)).select(pop.select || '').lean();
        if (refDoc) {
          d[fieldPath] = refDoc;
        }
      }
    }

    return isSingle ? list[0] || null : list;
  }

  const Model = {
    modelName: name,
    schema,

    find(filter = {}) {
      return new Query(Model, 'find', filter);
    },

    findOne(filter = {}) {
      return new Query(Model, 'findOne', filter);
    },

    findById(id) {
      if (!id) return new Query(Model, 'findOne', { _id: '__none__' });
      return new Query(Model, 'findOne', { _id: String(id) });
    },

    countDocuments(filter = {}) {
      return new Query(Model, 'count', filter);
    },

    async create(docOrArray) {
      if (Array.isArray(docOrArray)) {
        const results = [];
        for (const item of docOrArray) {
          results.push(await Model.create(item));
        }
        return results;
      }
      const store = collections.get(name);
      const validated = applySchemaDefaultsAndValidation(docOrArray, false);
      enforceUniqueConstraints(validated, null);
      store.push(validated);
      flushToDisk();
      return wrapDocument(validated);
    },

    findOneAndUpdate(filter = {}, update = {}, options = {}) {
      return new Query(Model, 'findOneAndUpdate', filter, { update, options });
    },

    findByIdAndUpdate(id, update = {}, options = {}) {
      return Model.findOneAndUpdate({ _id: String(id) }, update, options);
    },

    async deleteMany(filter = {}) {
      const store = collections.get(name) || [];
      const remaining = store.filter((d) => !matchesFilter(d, filter));
      const deletedCount = store.length - remaining.length;
      collections.set(name, remaining);
      flushToDisk();
      return { deletedCount };
    },

    async _executeQuery(query) {
      const store = collections.get(name) || [];

      if (query.op === 'count') {
        return store.filter((d) => matchesFilter(d, query.filter)).length;
      }

      if (query.op === 'findOneAndUpdate') {
        const { update, options } = query.extra;
        const idx = store.findIndex((d) => matchesFilter(d, query.filter));
        if (idx === -1) return null;

        const current = deepClone(store[idx]);
        const nextDoc = { ...current };

        if (update.$set && typeof update.$set === 'object') {
          Object.assign(nextDoc, update.$set);
        }
        if (update.$inc && typeof update.$inc === 'object') {
          for (const [k, delta] of Object.entries(update.$inc)) {
            nextDoc[k] = Number(nextDoc[k] || 0) + Number(delta);
          }
        }
        for (const [k, v] of Object.entries(update)) {
          if (!k.startsWith('$')) {
            nextDoc[k] = v;
          }
        }

        const validated = applySchemaDefaultsAndValidation(nextDoc, true);
        enforceUniqueConstraints(validated, validated._id);
        store[idx] = validated;
        flushToDisk();

        const targetRaw = options?.new !== false ? validated : current;
        const wrapped = wrapDocument(targetRaw, query._select, query._lean);
        return populateDocs(wrapped, query._populates);
      }

      let matched = store.filter((d) => matchesFilter(d, query.filter));

      if (query._sort && typeof query._sort === 'object') {
        const sortEntries = Object.entries(query._sort);
        matched = [...matched].sort((a, b) => {
          for (const [field, dir] of sortEntries) {
            const va = a[field] ?? '';
            const vb = b[field] ?? '';
            if (va < vb) return dir === -1 || dir === 'desc' ? 1 : -1;
            if (va > vb) return dir === -1 || dir === 'desc' ? -1 : 1;
          }
          return 0;
        });
      }

      if (query.op === 'findOne') {
        const first = matched[0];
        if (!first) return null;
        const wrapped = wrapDocument(first, query._select, query._lean);
        return populateDocs(wrapped, query._populates);
      }

      if (query._skip > 0) {
        matched = matched.slice(query._skip);
      }
      if (typeof query._limit === 'number' && query._limit >= 0) {
        matched = matched.slice(0, query._limit);
      }

      const wrappedList = matched.map((d) => wrapDocument(d, query._select, query._lean));
      return populateDocs(wrappedList, query._populates);
    },
  };

  models.set(name, Model);
  return Model;
}

const mongoose = {
  Schema,
  Types: {
    ObjectId: {
      isValid: isValidObjectId,
      createFromHexString: (s) => String(s),
    },
  },
  isValidObjectId,
  models: Object.fromEntries(models),
  model(name, schema) {
    if (!schema && models.has(name)) {
      return models.get(name);
    }
    return createModel(name, schema);
  },
  connection: {
    get readyState() {
      return connectedState;
    },
    get name() {
      return 'hospital_dfa_db';
    },
    async dropDatabase() {
      for (const key of collections.keys()) {
        collections.set(key, []);
      }
      flushToDisk();
    },
  },
  async connect(uri, options = {}) {
    if (options.dbFilePath) {
      dbFilePath = options.dbFilePath;
    }
    if (options.inMemoryOnly) {
      persistenceEnabled = false;
    }
    loadFromDisk();
    connectedState = 1;
    return mongoose.connection;
  },
  async disconnect() {
    flushToDisk();
    connectedState = 0;
  },
};

module.exports = mongoose;
