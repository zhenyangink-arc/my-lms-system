// SELECT-only, deterministic PostgREST transport for isolated history tests.
export function historyDb(tables, calls = []) {
  return {from(table) {
    const call = {table, filters: [], columns: '', orders: [], ors: [], limit: Infinity}; calls.push(call);
    return {
      select(columns, options) {call.columns = columns;call.countOnly=options?.head===true; return this;},
      eq(...args) {call.filters.push(args); return this;},
      in(...args) {call.filters.push(args); return this;},
      abortSignal(signal) {signal.throwIfAborted(); return this;},
      order(column, options = {}) {call.orders.push([column, options.ascending !== false]); return this;},
      or(expression) {call.ors.push(expression); return this;},
      limit(n) {call.limit = n; return this;},
      then(resolve) {
        let rows = [...(tables[table] ?? [])];
        for (const expression of call.ors) {
          const m = /^created_at\.(gt|lt)\.([^,]+),and\(created_at.eq.([^,]+),id\.(gt|lte)\.([^)]+)\)$/.exec(expression);
          if (!m || m[2] !== m[3]) throw Error('Unexpected keyset filter');
          rows = rows.filter(r => m[1] === 'gt' ? r.created_at > m[2] || (r.created_at === m[2] && r.id > m[5]) : r.created_at < m[2] || (r.created_at === m[2] && r.id <= m[5]));
        }
        rows.sort((a,b) => {for(const [column, asc] of call.orders) {if(a[column] !== b[column])return (a[column] < b[column] ? -1 : 1) * (asc ? 1 : -1);}return 0;});
        resolve({data: call.countOnly?[]:rows.slice(0,call.limit),count:rows.length,error:null});
      },
    };
  }};
}
