-- Firefly 匿名使用日志表（隐私安全：不存 IP / 身份 / 聊天内容）
-- 仅记录「某匿名访客使用了某接口」事件，用于 SQL 统计独立访客 / 调用次数 / 国家分布。
-- 在 Supabase 控制台 → SQL Editor 里执行本文件一次即可。

create table if not exists usage_events (
  id        bigint      generated always as identity primary key,
  ts        timestamptz not null,            -- 事件时间（ISO 8601）
  endpoint  text        not null,            -- chat | weather | items
  country   text        not null,            -- 国家代码（CN / US / local...），非真实 IP
  anon      text        not null,            -- 不透明随机会话 ID（ff_sid cookie），仅去重访客
  ok        boolean     not null default true
);

-- 常用查询索引
create index if not exists usage_events_ts_idx        on usage_events (ts desc);
create index if not exists usage_events_anon_idx      on usage_events (anon);
create index if not exists usage_events_endpoint_idx  on usage_events (endpoint);

-- 说明：服务端优先用 SUPABASE_SERVICE_ROLE_KEY 写入（绕过 RLS）；若缺失则回退
-- SUPABASE_ANON_KEY。本表未启用 RLS，故两种 key 读写等价，无需额外策略。

-- ===== 示例统计查询 =====

-- 累计独立访客数
-- select count(distinct anon) as unique_visitors from usage_events;

-- 今日各功能调用次数
-- select endpoint, count(*) as calls
-- from usage_events
-- where ts >= date_trunc('day', now())
-- group by endpoint order by calls desc;

-- 国家分布 Top 10（按独立访客）
-- select country, count(distinct anon) as visitors
-- from usage_events
-- group by country order by visitors desc limit 10;

-- 最近 7 天每日独立访客
-- select date_trunc('day', ts) as day, count(distinct anon) as visitors
-- from usage_events
-- where ts >= now() - interval '7 days'
-- group by day order by day;
