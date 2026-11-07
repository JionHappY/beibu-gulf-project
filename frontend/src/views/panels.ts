// 本页面板清单：位置事实的唯一出处（模板只 v-bind，不写字面量）。
// 左列两块 4×4 吞吐量图表；右列一块 4×4 城市发展指数（2026-11-07 新增）。
import { definePanels, type PanelSpec } from '@/shared'

export const HOME_PANELS: PanelSpec[] = definePanels([
  { id: 'trend', title: '港口吞吐量趋势', zone: 'left', order: 1, w: 4, h: 4, priority: 2 },
  { id: 'compare', title: '港口吞吐量对比', zone: 'left', order: 2, w: 4, h: 4, priority: 2 },
  { id: 'development', title: '城市发展指数', zone: 'right', order: 1, w: 4, h: 4, priority: 2 },
])
