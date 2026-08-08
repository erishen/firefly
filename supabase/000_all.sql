-- Firefly 一键建表 + 统计函数（合并 0001 / 0002 / 0003）。
-- 用法：Supabase 控制台 → SQL Editor，把本文件整体粘贴执行一次即可。
-- 顺序：先建两张表，再建两个聚合函数（create or replace，可重复跑）。
-- 隐私说明：所有表仅存匿名会话 ID / 国家代码 / 事件，绝不存真实 IP / 身份 / 聊天内容。

-- ============ 0001 usage_events（谁使用了哪个接口） ============
create table if not exists usage_events (
  id        bigint      generated always as identity primary key,
  ts        timestamptz not null,            -- 事件时间（ISO 8601）
  endpoint  text        not null,            -- chat | weather | items
  country   text        not null,            -- 国家代码（CN / US / local...），非真实 IP
  anon      text        not null,            -- 不透明随机会话 ID（ff_sid cookie），仅去重访客
  ok        boolean     not null default true
);

create index if not exists usage_events_ts_idx        on usage_events (ts desc);
create index if not exists usage_events_anon_idx      on usage_events (anon);
create index if not exists usage_events_endpoint_idx  on usage_events (endpoint);

-- ============ 0002 usage_stats()（供 /api/stats 调用） ============
create or replace function usage_stats()
returns json
language sql
stable
as $$
  select json_build_object(
    'unique_visitors',   (select count(distinct anon) from usage_events),
    'total_events',      (select count(*) from usage_events),
    'today_by_endpoint', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json)
      from (
        select endpoint, count(*) as calls
        from usage_events
        where ts >= date_trunc('day', now())
        group by endpoint
        order by calls desc
      ) t
    ),
    'country_top', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json)
      from (
        select country, count(distinct anon) as visitors
        from usage_events
        group by country
        order by visitors desc
        limit 10
      ) t
    ),
    'daily_last_7d', (
      select coalesce(json_agg(row_to_json(t) order by day), '[]'::json)
      from (
        select date_trunc('day', ts)::date as day, count(distinct anon) as visitors
        from usage_events
        where ts >= now() - interval '7 days'
        group by day
      ) t
    )
  );
$$;

-- ============ 0003 model_loads（VRM 模型加载健康度） ============
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
