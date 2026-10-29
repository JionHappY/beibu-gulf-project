/**
 * 前端 zod schema 的契约覆盖豁免登记（`gen-api-contract.cjs` 的输入之一）。
 *
 * 为什么单独成文件：覆盖闭集是**数据**而不是判据。判据（未登记必红、过期必红、
 * 类别非法必红）留在生成脚本里；登记表能独立被测试读取/合成，避免为了测一条
 * 判据去改生产 schemas.ts。
 *
 * 三类豁免（新增第四类须先改 EXEMPTION_CLASSES 并说明为什么三类不够）：
 * - frontend-only：无后端端点，来源是静态资产或本地缓存；
 * - nested：嵌套元素/包装，字段由父 schema 或元素 schema 核对；
 * - no-named-type：后端有端点但没有可逐字段配对的对象响应类型（数组/联合/内联 view）。
 *
 * 未注解且未登记的 schema 会让 `types:check` 变红；已注解又登记视为过期。
 */
const EXEMPTION_CLASSES = {
  'frontend-only': '无后端端点：静态资产 / 本地缓存，来源不是 HTTP 响应',
  nested: '嵌套元素 / 包装：字段由父 schema 或元素 schema 核对',
  'no-named-type': '后端有端点但无对象响应类型可逐字段配对（数组 / 联合 / 内联 view）',
}

const SCHEMA_EXEMPTIONS = {
  floodGeometrySchema: {
    class: 'nested',
    reason: 'floodFeatureSchema / boundaryFeatureSchema 的 geometry 元素',
  },
  affectedFacilitySchema: {
    class: 'nested',
    reason: 'floodDisasterResponseSchema 的设施元素',
  },
  boundaryFeatureSchema: {
    class: 'nested',
    reason: 'boundaryFeatureCollectionSchema 的元素',
  },
  boundaryFeatureCollectionSchema: {
    class: 'frontend-only',
    reason: '前端静态 boundary GeoJSON 响应，不是 Nest 端点',
  },
  boundaryCacheSchema: {
    class: 'frontend-only',
    reason: 'sessionStorage 本地缓存形状',
  },
  authResponseSchema: {
    class: 'nested',
    reason: '仅包装 userSchema；/auth 响应已有具名 view 类型',
  },
  forecastPointSchema: {
    class: 'nested',
    reason: 'forecast 三个响应的时序点元素',
  },
  planSchema: {
    class: 'no-named-type',
    reason: '后端 PlanRow 是 DB 行，API view 由 payload 合并组装，无具名响应类型',
  },
  portSchema: {
    class: 'frontend-only',
    reason: '前端静态 /data/ports.json',
  },
  portsArraySchema: {
    class: 'frontend-only',
    reason: '前端静态 /data/ports.json 数组包装',
  },
  tilesetJsonSchema: {
    class: 'frontend-only',
    reason: '静态 3D Tiles 资产边界',
  },
  pingluImageryIndexSchema: {
    class: 'frontend-only',
    reason: '静态离线影像索引资产',
  },
  favoriteItemSchema: {
    class: 'no-named-type',
    reason: 'repository toView 未导出具名 view 类型',
  },
  favoritesArraySchema: {
    class: 'no-named-type',
    reason: '收藏列表是 view 数组，view 无具名类型',
  },
  favoriteAddResponseSchema: {
    class: 'no-named-type',
    reason: 'controller 返回 {favorite: unknown, existed}，favorite 无具名 view',
  },
  favoriteRemoveResponseSchema: {
    class: 'no-named-type',
    reason: 'controller 内联 {removed: boolean}',
  },
}

module.exports = { EXEMPTION_CLASSES, SCHEMA_EXEMPTIONS }
