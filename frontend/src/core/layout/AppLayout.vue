<script setup lang="ts">
/**
 * AppLayout - GCS（网格化布局系统）V2 布局基座
 * 用 PPS（面板定位系统）直接定位所有 Panel（无容器/Zone/TopArea），slot（Vue 插槽）供业务页注入面板内容。
 * 底部 nav 3 按钮（首页/个人中心/菜单），业务入口与城市切换在抽屉菜单中；
 * 抽屉模式（<960px）下抽屉同时承载业务面板（slot left/right）。
 */

import { computed, defineAsyncComponent, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { MAP_CONFIG } from '@/core/config/map'
import { useMapControls } from '@/core/map/composables/useMapControls'
import LayerControlPanel from '@/core/map/components/LayerControlPanel.vue'
import HomeAnalysisGrid from './components/HomeAnalysisGrid.vue'
import { PanelTitle, useGCS, useTheme } from '@/shared'

import BottomNavBar from './components/BottomNavBar.vue'
import GCSPanel from './components/GCSPanel.vue'
import MobileDrawer from './components/MobileDrawer.vue'
import NavButton from './components/NavButton.vue'
import { type NavItem, navItems } from './navConfig'
import { useMobileDrawer } from './useMobileDrawer'
import { useSliderFocus } from './useSliderFocus'

const route = useRoute()
const router = useRouter()
const { showPanels, showTopArea, navCompact, cellPixel } = useGCS()
const { flyTo } = useMapControls()
// 城市切换（必要性审判波次二·单元 F）：原 useScreenActions 只是 flyTo 的同义转发层，
// 就地按 MAP_CONFIG.CITY_CENTERS（单一权威源）取坐标，不新增第二份城市表。
function flyToCity(city: string): void {
  const target = MAP_CONFIG.CITY_CENTERS[city]
  if (!target) return
  flyTo({ lng: target.lng, lat: target.lat }, { height: target.height, zoom: target.zoom })
}
// 主题切换：图标显示当前模式的另一侧（暗色显示 ☀️、亮色显示 🌙）
const { isDark, toggleTheme } = useTheme()
// 抽屉开关（模块级单例，nav 菜单按钮与抽屉共享）
const { drawerOpen, closeDrawer } = useMobileDrawer()
// 滑块专注模式（模块级单例，滑块组件调用 begin/end）
const { active: sliderFocusActive, activePanel: sliderActivePanel } = useSliderFocus()

// 抽屉业务行：取 navConfig 中 type=business 的项（core 不引 business，由 App.vue 注入）
const businessNavItems = computed<NavItem[]>(() => [
  ...navItems.value.filter((i) => i.type === 'business'),
])

// 雷达图依赖 ECharts；保持动态加载，避免布局基座把它并进首屏入口图。
const GlobalRadarPanel = defineAsyncComponent(() => import('./components/GlobalRadarPanel.vue'))

// 专注模式 class 挂 body 而非根节点：抽屉 Teleport 到 body，根节点选择器匹配不到抽屉内面板。
// body 加 slider-focus-mode（CSS 透明化其他面板），滑块所在面板标记 slider-focus-panel，底部 nav 排除。
watch(sliderFocusActive, (act) => {
  document.body.classList.toggle('slider-focus-mode', act)
  document.querySelectorAll('.GCS-panel').forEach((p) => {
    p.classList.toggle('slider-focus-panel', act && p === sliderActivePanel.value)
  })
})

// 手机档（<640）把地图压到上半屏：统一挂在 body 上，由 style.css 收 .unified-map-wrapper 高度。
// 用 body class 而非媒体查询，断点仍只由 useGCS 的 layoutTierFor 一处判定。
watch(navCompact, (on) => document.body.classList.toggle('layout-console', on), { immediate: true })
onUnmounted(() => document.body.classList.remove('layout-console'))
// 控制台底部让开 dock（dock 是 1 cell 高的 GCSPanel，同源取 cellPixel，不写死像素）
const consoleStyle = computed(() => ({ bottom: `${Math.round(cellPixel.value * 1.7)}px` }))

// 专注态激活期间切路由 ⇒ 旧页 AppLayout 卸载，而 useSliderFocus 的
// onScopeDispose(endSliderFocus) 与本 watch 的效果在同一批 scope.stop() 里停掉，
// 排队的 pre-flush 回调被丢弃（真 vue 3.5.41 实测 after stop: class 仍在）⇒
// body class 永久残留，style.css:350 令全站面板 opacity:0 但仍吃指针事件。
// 本组件是 body class 的唯一写方，卸载时必须显式摘除（含面板标记）。
onUnmounted(() => {
  document.body.classList.remove('slider-focus-mode')
  document.querySelectorAll('.GCS-panel.slider-focus-panel').forEach((p) => {
    p.classList.remove('slider-focus-panel')
  })
})

function isActive(path: string): boolean {
  return route.path === path
}

/** 跳转业务模块并关闭抽屉（navConfig 注入项） */
function goBusiness(item: NavItem): void {
  if (item.disabled || !item.path) return
  void router.push(item.path)
  closeDrawer()
}
</script>

<template>
  <div class="app-layout">
    <!-- ===== 桌面端：绝对定位 PPS 面板（≥960px） ===== -->
    <template v-if="showPanels">
      <!-- Title Panel（4×1，左上，第一行） -->
      <GCSPanel
        v-show="showTopArea"
        :w="4"
        :h="1"
        anchor="top-left"
        :offset-x="0"
        :offset-y="0"
        class="title-panel"
      >
        <PanelTitle :title="(route.meta?.title as string) || '北部湾智慧港口平台'" />
      </GCSPanel>

      <!-- 顶部城市切换按钮组（4×1 右上，档位 1 原位显示；<960px 时在抽屉菜单内） -->
      <GCSPanel
        v-show="showTopArea"
        :w="4"
        :h="1"
        anchor="top-right"
        :offset-x="0"
        :offset-y="0"
        class="top-button-panel"
      >
        <div class="top-button-inner">
          <!-- 城市列表由 MAP_CONFIG.CITY_CENTERS 驱动（勿手写城市名双轨） -->
          <NavButton
            v-for="city in Object.keys(MAP_CONFIG.CITY_CENTERS)"
            :key="city"
            :label="city"
            @click="flyToCity(city)"
          />
          <!-- 主题切换（🌙/☀️） -->
          <NavButton
            :icon="isDark ? '☀️' : '🌙'"
            class="theme-toggle"
            aria-label="切换主题"
            @click="toggleTheme"
          />
        </div>
      </GCSPanel>

      <!-- 左侧 Panel 组：由业务页通过 #left slot 注入 -->
      <slot name="left" />

      <!-- 右侧 Panel 组 -->
      <div v-show="showPanels">
        <slot name="right">
          <!-- 右上：雷达图 4×4（与选址分析同源：分析结果第一名，未分析时快照兜底） -->
          <GlobalRadarPanel />
          <!-- 右下：图层控制 4×4 -->
          <GCSPanel :w="4" :h="4" anchor="top-right" :offset-x="0" :offset-y="5.5">
            <LayerControlPanel />
          </GCSPanel>
        </slot>
      </div>
    </template>

    <!-- ===== 控制台（手机档 <640px） =====
         地图收上半屏，原抽屉里的图层控制 / 业务面板整体搬到下半屏（压缩排版，尽量一屏放完）。
         抽屉在手机档不再渲染——入口是 dock 的 ＋ 半圆，内容是这张控制台。 -->
    <section v-if="navCompact" class="mobile-console" :style="consoleStyle" aria-label="控制台">
      <div class="console-head">
        <span class="console-title">{{
          (route.meta?.title as string) || '北部湾智慧港口平台'
        }}</span>
        <div class="console-cities">
          <NavButton
            v-for="city in Object.keys(MAP_CONFIG.CITY_CENTERS)"
            :key="city"
            :label="city"
            @click="flyToCity(city)"
          />
          <NavButton
            :icon="isDark ? '☀️' : '🌙'"
            class="theme-toggle"
            aria-label="切换主题"
            @click="toggleTheme"
          />
        </div>
      </div>
      <div class="console-body">
        <template v-if="route.name === 'Home'">
          <HomeAnalysisGrid />
          <div class="console-card"><LayerControlPanel /></div>
        </template>
        <template v-else-if="route.name === 'Profile'">
          <slot name="right" />
        </template>
        <template v-else>
          <slot name="right" />
          <slot name="left" />
        </template>
      </div>
    </section>

    <!-- ===== 抽屉菜单（平板档 640–959px） =====
         业务入口（sticky 冻结首行）+ 城市切换 + 业务面板；手机档已由上方控制台承接 -->
    <MobileDrawer v-if="!navCompact" :open="drawerOpen" @close="closeDrawer">
      <div class="drawer-menu">
        <!-- 业务入口行：滚动时冻结（sticky） -->
        <div class="drawer-menu__row drawer-menu__row--sticky" aria-label="业务功能">
          <NavButton
            v-for="m in businessNavItems"
            :key="m.label"
            :label="m.label"
            :icon="m.icon"
            :disabled="m.disabled"
            :active="isActive(m.path)"
            @click="goBusiness(m)"
          />
        </div>
        <!-- 城市切换 + 主题切换行 -->
        <div class="drawer-menu__row" aria-label="城市切换">
          <!-- 同上：CITY_CENTERS 驱动（z154②） -->
          <NavButton
            v-for="city in Object.keys(MAP_CONFIG.CITY_CENTERS)"
            :key="city"
            :label="city"
            @click="flyToCity(city)"
          />
          <NavButton
            :icon="isDark ? '☀️' : '🌙'"
            class="theme-toggle"
            aria-label="切换主题"
            @click="toggleTheme"
          />
        </div>
        <!-- 抽屉面板内容：只放功能面板；首页→图层控制，个人中心→right slot，业务页→left/right slot -->
        <template v-if="!showPanels">
          <template v-if="route.name === 'Home'">
            <GCSPanel :w="4" :h="4"><LayerControlPanel /></GCSPanel>
            <!-- 桌面左侧的两张概览图在窄屏原本完全不可达（Home 分支只注入图层控制）；
                 补 #left 后抽屉内可滚动查看，数据与桌面同源。 -->
            <slot name="left" />
          </template>
          <template v-else-if="route.name === 'Profile'">
            <slot name="right" />
          </template>
          <template v-else>
            <!-- 操作/控制面板（right slot）在前，可视化面板（left slot）在后：避免首屏全是空白图表 -->
            <slot name="right" />
            <slot name="left" />
          </template>
        </template>
      </div>
    </MobileDrawer>

    <!-- 底部导航（3 按钮：首页/个人中心/菜单） -->
    <BottomNavBar />
  </div>
</template>

<style scoped>
.app-layout {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: var(--GCS-z-layout); /* 壳层档（原散落 50） */
}

/* 所有 Panel 子元素恢复 pointer-events */
.app-layout > * {
  pointer-events: auto;
}

/* Title Panel 容器样式 */
.title-panel {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 顶部城市切换按钮组内部样式 */
.top-button-panel {
  display: flex;
  align-items: center;
  justify-content: center;
}

.top-button-inner {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-around;
  box-sizing: border-box;
}

/* ===== 手机档控制台 ===== */
.mobile-console {
  position: absolute;
  left: 0;
  right: 0;
  top: 46vh;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  background-color: var(--GCS-bg-page);
  border-top: 1px solid var(--GCS-border-light);
  pointer-events: auto;
  box-sizing: border-box;
}

.console-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex: none;
}

.console-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--GCS-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.console-cities {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: none;
}

.console-cities :deep(.GCS-button) {
  --GCS-button-w: 44px;
  --GCS-button-h: 26px;

  font-size: 11px;
}

/* 内容区唯一可滚动的地方；面板改为正常流堆叠，压缩后尽量一屏放完 */
.console-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  display: flex;
  flex-direction: column;
  gap: 4px;

  /* 末端留白：最后一行（如年份刻度）贴到滚动区底边时会被 dock 上沿的
     拖拽手柄压住半个字，实测 390×844 预测页 */
  padding-bottom: 12px;
}

.console-card {
  background-color: var(--GCS-bg-panel);
  border-radius: var(--GCS-radius-md);
  box-shadow: var(--GCS-shadow-sm);
  padding: 6px;
}

/* 面板进控制台后按内容高度堆叠。
   GCSPanel 把 left/top/width/height 写成内联 CSS 变量，所以这里必须 !important 才压得住
   （与 style.css 里 .GCS-drawer__body .GCS-panel 的抽屉归一化同一手法）。 */
.console-body :deep(.GCS-panel) {
  position: static !important;
  width: 100% !important;
  height: auto !important;
  min-width: 0 !important;
  min-height: 0 !important;
  margin: 0 !important;
  overflow: visible !important;

  /* flex 列里不能压缩：被压扁时内层内容会溢出到面板外、盖住 dock */
  flex: 0 0 auto !important;
  padding: 6px;
}

.console-body :deep(.GCS-panel > *) {
  height: auto;
}

/* 图表给确定高度：面板改 auto 后 flex:1 的挂载点会塌成 0，ECharts 按 0 高初始化 */
.console-body :deep(.line-chart),
.console-body :deep(.bar-chart),
.console-body :deep(.suit-radar-chart),
.console-body :deep(.transfer-chart),
.console-body :deep(.chart-container) {
  flex: 0 0 auto;
  height: 110px;
}

/* 压缩：面板内的区块间距与字号整体收一档（目标是一屏放完，不靠滑） */
.console-body :deep(.GCS-panel) {
  font-size: 11.5px;
  line-height: 1.35;
}

/* 内容区不许再按 cell 高度 flex 撑满 */
.console-body :deep(.GCS-panel > * > *) {
  min-height: 0;
}

.console-body :deep(.GCS-panel .layer-grid),
.console-body :deep(.GCS-panel .btn-grid),
.console-body :deep(.GCS-panel .criteria-grid) {
  gap: 4px;
}

/* ===== 抽屉菜单 ===== */
.drawer-menu {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.drawer-menu__row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  padding: 8px 0;
}

/* 业务入口行冻结：抽屉 body 滚动时保持可见（sticky 相对 .GCS-drawer__body） */
.drawer-menu__row--sticky {
  position: sticky;
  top: 0;

  /* 局部层叠上下文（抽屉 body 内），不参与全局 --GCS-z-* 刻度 */
  z-index: 5;
  background: var(--GCS-bg-panel);
  border-bottom: 1px solid var(--GCS-border-light);

  /* 5 个业务入口默认在 294px 抽屉里排成 4+1（第 5 项单吊一行）观感失衡；
     限宽到 200px 后稳定 3+2 两行居中，行高不变。 */
  max-width: 200px;
  margin-inline: auto;
}

/* 主题切换按钮 emoji 放大（默认偏小，仅作用于 .theme-toggle） */
:deep(.theme-toggle .button-icon) {
  font-size: 1.6em;
  margin-top: 0;
}
</style>
