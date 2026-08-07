-- Firefly 使用统计聚合函数（供 /api/stats 调用）。
-- 在 Supabase SQL Editor 执行一次（create or replace，可重复跑）。
-- 依赖 0001 的 usage_events 表。

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
