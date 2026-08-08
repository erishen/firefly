-- 模型加载监控表（Firefly VRM 加载成功与否、耗时、是否命中缓存）
-- 与 usage_events 平行：usage_events 记录「谁使用了接口」，model_loads 记录「模型加载健康度」。
create table if not exists model_loads (
  ts          timestamptz not null default now(),
  ok          boolean      not null,
  ms          integer,                 -- 加载耗时（毫秒）
  from_cache  boolean,                 -- 是否命中浏览器 Cache API 缓存
  url         text,                    -- 模型地址（不含查询串，不泄露签名）
  error       text,                    -- 失败原因（截断）
  country     text,                    -- 国家代码（来自 x-vercel-ip-country）
  anon        text                     -- 匿名会话 ID（ff_sid）
);

create index if not exists idx_model_loads_ts on model_loads (ts desc);
create index if not exists idx_model_loads_ok on model_loads (ok);

-- 模型加载统计聚合（供 /api/stats 调用）
create or replace function model_load_stats()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'total_loads',     count(*),
    'success_loads',   count(*) filter (where ok),
    'fail_loads',      count(*) filter (where not ok),
    'success_rate',    round(100.0 * count(*) filter (where ok) / nullif(count(*), 0), 2),
    'avg_ms',          round(avg(ms)),
    'p95_ms',          (
      select percentile_cont(0.95) within group (order by ms)::int
      from model_loads where ms is not null
    ),
    'cache_hits',      count(*) filter (where from_cache),
    'recent_failures', coalesce((
      select jsonb_agg(jsonb_build_object('ts', ts, 'url', url, 'error', error, 'country', country))
      from (
        select ts, url, error, country
        from model_loads
        where not ok
        order by ts desc
        limit 10
      ) f
    ), '[]'::jsonb)
  )
  from model_loads
$$;
