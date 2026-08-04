// 天气工具（Open-Meteo，免费、无需 API Key、全球覆盖）
// 流程：先地理编码拿到经纬度，再查实时天气，返回给模型一段结构化简述。
// 全程在服务端完成，浏览器只看到同源 /api/weather；如需换成需 Key 的提供商，改这里即可。
import { proxyAgent } from './config.mjs'
import { fetchWithTimeout } from './httpUtils.mjs'

// WMO 天气代码 → 中文描述
const WMO = {
  0: '晴', 1: '大致晴朗', 2: '部分多云', 3: '阴',
  45: '雾', 48: '雾凇',
  51: '小毛毛雨', 53: '毛毛雨', 55: '大毛毛雨',
  56: '冻毛毛雨', 57: '强冻毛毛雨',
  61: '小雨', 63: '中雨', 65: '大雨',
  66: '冻雨', 67: '强冻雨',
  71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒',
  80: '小阵雨', 81: '阵雨', 82: '强阵雨',
  85: '小阵雪', 86: '大阵雪',
  95: '雷暴', 96: '雷暴伴小冰雹', 99: '雷暴伴大冰雹',
}

function wmoText(code) {
  return WMO[code] ?? '未知天气'
}

// 查询实时天气。
//   args.city            城市名（地理编码用）
//   args.lat/lon         用户经纬度（已知时优先直查，跳过地理编码）
//   args.location        {lat, lon} 兜底：用户已授权定位但未传经纬度时使用
// 优先级：lat/lon → location → city 地理编码。
// 无 cityName（定位直查场景）则不写城市行，呼应「回复不点名城市」。
// 返回 { ok, summary?, city?, raw?, error? }
export async function fetchWeather(args = {}, dispatcher = proxyAgent) {
  const { city, lat, lon, location } = args
  let latitude
  let longitude
  if (typeof lat === 'number' && typeof lon === 'number') {
    latitude = lat
    longitude = lon
  } else if (location && typeof location.lat === 'number' && typeof location.lon === 'number') {
    latitude = location.lat
    longitude = location.lon
  }

  try {
    let cityName = ''
    // 有经纬度 → 直接查天气，跳过地理编码（定位场景，不暴露城市名）
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      // cityName 保持空
    } else {
      // 否则需要 city 做地理编码
      if (!city || !city.trim()) {
        return { ok: false, error: '未提供城市或经纬度，无法查询天气' }
      }
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        city.trim(),
      )}&count=1&language=zh&format=json`
      const geoRes = await fetchWithTimeout(geoUrl, { dispatcher: dispatcher || undefined }, 8000)
      if (!geoRes.ok) return { ok: false, error: `地理编码服务返回 ${geoRes.status}` }
      const geo = await geoRes.json()
      const loc = geo.results && geo.results[0]
      if (!loc) return { ok: false, error: `找不到城市「${city}」，请换个城市名或写法试试` }
      latitude = loc.latitude
      longitude = loc.longitude
      cityName = loc.name + (loc.country ? `（${loc.country}）` : '')
    }

    const fcUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}` +
      `&longitude=${longitude}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
      `&timezone=auto`
    const fcRes = await fetchWithTimeout(fcUrl, { dispatcher: dispatcher || undefined }, 8000)
    if (!fcRes.ok) return { ok: false, error: `天气服务返回 ${fcRes.status}` }
    const fc = await fcRes.json()
    const c = fc.current
    if (!c) return { ok: false, error: '天气数据缺失' }
    const lines = []
    if (cityName) lines.push(`城市：${cityName}`)
    lines.push(`天气：${wmoText(c.weather_code)}`)
    lines.push(`气温：${c.temperature_2m}°C（体感 ${c.apparent_temperature}°C）`)
    lines.push(`湿度：${c.relative_humidity_2m}%`)
    lines.push(`风速：${c.wind_speed_10m} km/h`)
    return { ok: true, summary: lines.join('\n'), city: cityName || undefined, raw: c }
  } catch (e) {
    const isTimeout = e?.name === 'AbortError'
    return {
      ok: false,
      error: isTimeout ? '天气服务请求超时（上游未响应）' : `天气查询失败：${e?.message || String(e)}`,
    }
  }
}

// 暴露给 LLM 的天气工具定义（OpenAI 兼容 function calling 格式）
export const WEATHER_TOOL = {
  type: 'function',
  function: {
    name: 'get_weather',
    description:
      '查询天气（温度、天气状况、体感温度、湿度、风速）。当用户询问天气、气温、是否下雨/下雪、出门要不要带伞等时使用。',
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description:
            '城市名称，例如：北京、上海、Tokyo、London。若系统已知用户经纬度可省略，由系统用用户位置兜底。',
        },
        latitude: {
          type: 'number',
          description: '用户纬度（已知时优先用，跳过地理编码）',
        },
        longitude: {
          type: 'number',
          description: '用户经度',
        },
      },
      // 均非必填：可传 city、可传经纬度、也可留空由系统用用户位置兜底
    },
  },
}
