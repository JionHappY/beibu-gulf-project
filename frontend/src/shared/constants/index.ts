// shared/constants 公开面入口。
//
// 没有它时，「target 组有入口才不许穿透」这条口径无从落地：`shared/constants/*` 的
// 深路径被当成"无法收敛的存量"计入基线。建入口后，新代码一律 `@/shared/constants`。
//
export * from './api'
export * from './bizCodes'
export * from './chart'
export * from './colors'
export * from './flood'
export * from './forecast'
export * from './layers'
export * from './semantic-colors'
export * from './storageKeys'
export * from './tolerance'
export * from './ui'
