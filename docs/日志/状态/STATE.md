# 接手状态档（STATE）— 唯一滚动状态正本

> **定位**：接管新会话只需读本文件 + `docs/文档地图.md`（索引），不必读 1MB 历史。
> 历史正文已按日期归档到 `docs/日志/状态/archive/`（零改写，见 `archiveIndex`）。
> **写入纪律**：只改字段值 + 同步 `updatedAt`；不追加历史段落（历史进 archive 或台账）。
> `branch` / `head` / `worktree` / `unpushed` 四项**只存命令，不存结果**——结果是过期源。

## 字段（18 个，超出即删）

- `updatedAt`：2026-10-30
- `currentGoal`：三条对外承诺各配一条**会红**判据——能打开（公网 443 返回应用正文）、能接手（本文件在 `STATE_READ_BUDGET` 预算内且冷启动可答；**数值只在** `tools/v3-guard/protocol-single-source.mjs`，本文件不复述，超限即 `guard:v3` 红）、能合法用（来源守卫在 CI 执行且 pending/失实都红）。来源：`.local/AGENT-工单-交付边界-20261027.md` §一
- `currentPhase`：八专项阶段 3 批 10 完成（数据三项 + z172 已关闭；累计关闭 49 项、open 9）；剩余设计四项执行中 + 架构五项待推进
- `activeTask`：八专项分批修复已按 28/28/28/27 工作量四分；阶段 1+2+3 共关闭 49 项，余 9 项
- `nextAction`：① WorkBuddy 正在执行设计四项 c081/c082/c085/c087；② 之后架构五项 b111/z186-z189；③ 阶段 3 收口前跑整链与完成审计
- `branch`：`git rev-parse --abbrev-ref HEAD`
- `head`：`git rev-parse --short HEAD`
- `worktree`：`git status --porcelain`
- `unpushed`：`git log --oneline origin/main..HEAD`
- `ciStatus`：以 GitHub Actions 为准（本字段不手填）。最近一次已核对：run `40474535301`（`da57e376`）全 job success，`test:tools` 990、`guard:v3` 32/32（`docs/日志/状态/archive/接力状态-06-2026-10-26至2026-10-27.md`，2026-10-27 节）
- `deployedImage`：未确认，需读 deploy job 日志：`gh run view <run-id> --log`（无 gh 时用 Actions 页面）
- `publicEntry`：**不可打开**——`http://beibu-gulf.duckdns.org/` 实测 `403 Forbidden` / `Server: Beaver` / 正文 `Non-compliance ICP Filing` ⇒ 阿里云**备案拦截**，不是 nginx/证书问题。复现：`curl.exe -sS --noproxy "*" -I http://beibu-gulf.duckdns.org/`（2026-10-28；本机 `HTTP_PROXY=127.0.0.1:7890`，不带 `--noproxy` 会得到 502）
- `openDecisions`：① W1 接入路线（隧道 / 境外反代 / 迁机 / 备案）② `pending` 是当场红还是 `reviewBy` 到期红 ③ §8.21 的 `qinzhou-port` / `bridges-city` 是否入库（约 +157MB）。三项均**不得由执行方选边**，见工单 §四
- `externalBlockers`：① 阿里云备案主体状态未知（需控制台，无凭据代人查）② 服务器能否出网到 Cloudflare 未验证 ③ `PUBLIC_URL` 未配置 ⇒ CI 公网断言无法落地 ④ E-8：push 前哨被仓库根外来目录 `_traetmp/` 阻断（`docs/日志/状态/外部依赖登记.md` E-8）
- `activeFiles`：`docs/待解决问题.md`、`docs/已解决问题.md`、`docs/日志/状态/STATE.md`、`scripts/gen-api-contract.cjs`、`scripts/lib/schema-exemptions.cjs`、`tools/api-contract-fields.test.mjs`、`tools/ci-audit-policy.test.mjs`、`package.json`、`package-lock.json`、`.github/workflows/ci.yml`
- `verificationDebt`：① CI 未含公网入口断言（待 `PUBLIC_URL`）② `audit:data` 已接 CI 但 `pending` 不参与退出码（待裁决②）③ W4 的 `tileset.json` 探活判据未做（待裁决③）④ **已解除**：整链由主监工 **2026-10-28** 在 **Git Bash** 实测全绿 —— `npm run test:tools` ⇒ **99 文件 / 997 用例全绿、零 skip**；`sh .husky/pre-push` ⇒ **exit 0，15/15 全绿**（含前端 148 文件 / 1047、后端 552 passed + 81 门控跳过）；`npm run docs:check` 绿。**已作废的历史条件**（保留备查，不再算在册债务）：PowerShell 下 `test:tools` 6 格红、`sh .husky/pre-push` 跑不了，根因是本机无 POSIX `sh`、`bash` 仅为 WSL 转发壳（`execvpe(/bin/bash) failed`）；另一次 `test:report:fe` 因 IDE safe-delete shim 拦 `frontend/coverage/.tmp` 清理而 exit 1（测试本身全绿）—— 三者均被上述 Git Bash 实测推翻（`pre-push` 第 14 步即 `test:report:fe`）。仍开放：`ci-backend-db` 需 Docker daemon，**未复测**。⑤ 干净检出只复跑了快集守卫与两条 CLI（32/32 + exit 0），单测未在干净检出复跑（不复用工作树 `node_modules`）——**仍开放**。⑥ **阶段 2 首批本机实测（2026-10-28/29）**：前端 152 文件 / 1064 用例、后端 59 文件 / 558 passed + 81 skip、tools 99 文件 / 1000 用例、`guard:v3` 32/32、`cruise` 381 modules / 1081 deps 零违规、deep-import 49≤49、双端 typecheck、stylelint、types:check、docs:check 全绿；z178 新 build 首屏 11 条 modulepreload / 346KB gzip（改前 16 / 561KB），echarts 与业务页面 0 命中。`sh .husky/pre-push` **15/15、exit 0**（`guard:mutation` 33/33 全 killed；z185 新回归在注入 worktree 的包定位问题已由 `064fb0ad` 修复）。**阶段 2 批 2（2026-10-29）整链**：a096 UnifiedMap 22/22、b109 store 7/7、c073 useECharts 3/3、z174 typecheck 零输出且注入 TS6133 必红；前后端全量 152 文件 / 1068 用例、558 passed + 81 skip，tools 99 文件 / 1000 用例，`guard:v3` 32/32、`guard:mutation` 33/33 killed，`sh .husky/pre-push` 15/15、exit 0（日志 `.local/pre-push-batch2.log`）。**阶段 2 批 3（2026-10-29）整链**：c075 tokenContrast 3/3、c076/c078 designTokenUsage 与 c079 GCSButton 共 10/10、c077 SuitabilityRadarPanel 5/5，五项均有摘除红样与 md5 还原；前端全量 155 文件 / 1081 用例、后端 558 passed + 81 skip，tools 99/1000，`guard:v3` 32/32、`guard:mutation` 33/33 killed；`sh .husky/pre-push` 15/15、exit 0（日志 `.local/pre-push-batch3.log`）。c078 真实键盘浏览器未取证。**阶段 3 批 1（2026-10-29）**：d148 DTO 14/14、backend typecheck 绿；z173 lint 0 error；z180键集核对；z181 compose config 三服务 logging 一致；z190 token-stats 1/1 且 root-only 颜色红样 exit1。`d4117a4f` 混笔见 knownFailures⑥。整链待复跑。a095 浏览器 toggle 观感仍未实测。**阶段 3 批 2（2026-10-29）**：b106 年度聚合后端 27/27、前端 24/24，改回单月必红（1055 vs 12660）；b107 报告状态 6/6、z039 3/3、面板 12/12、store 74/74，三条变异分别 2/3/1 failed；前端 typecheck、eslint、stylelint、prettier 通过。整链待四项完成后统一复跑。**阶段 3 批 2 收口（2026-10-29）**：d147 types:check 20 注解/16 豁免、contract-fields 33/33、backend typecheck 绿、controller 34/34+5 skip、服务 58/58、改名变异红；z179 `npm ci` 800 packages 成功、三版本 1.12.0/7.30.1/8.3.5、三档 audit rc=0、策略测试 4/4、改 critical 为 none ⇒ 2 failed。**阶段 3 批 2 整链（2026-10-29）**：前端 156 文件 / 1091 用例、后端 565 passed + 82 登记跳过、覆盖率 70.32/62/69.05/72.8、`guard:v3` 32/32、`guard:mutation` 33/33 killed、`sh .husky/pre-push` 15/15 exit 0（日志 `.local/pre-push-stage3-batch2-rerun3.log`）。**阶段 3 批 3（2026-10-29）**：d145 route/site 仓储 23/23、两处摘 transform 各 1 failed、真库 ST_SRID=4490；d144 临时表 n=2/bad=0、注入 NULL => false、access 夹具 nulls=0；a097 例外登记 + 模板注释。**批 3 整链**：前端 156 文件 / 1091 用例、后端 565 passed + 82 登记跳过、`guard:v3` 32/32、`guard:mutation` 33/33、`sh .husky/pre-push` 15/15 exit 0（日志 `.local/pre-push-stage3-batch3.log`）。**批 4（2026-10-29）**：z191 改人工判据，复核命令命中仅 useGCS/useSliderFocus 经 layoutTierFor 与 useTheme 配色媒体查询；专项7 指标5.6 与 K2 §5.4 同步。**批 4b**：c083 字面圆角 29→3（三条几何豁免）、c084 时长 40→4（0.8/1.4 加载专用）；stylelint 0 问题、前端 156/1091。**批 4b 整链**：`sh .husky/pre-push` 15/15 exit 0，前端 156/1091、后端 565+82、guard 32/32、mutation 33/33（`.local/pre-push-stage3-batch4.log`）。**批 5（2026-10-29）**：z175 双断言 why/exit 全覆盖（missing 0），2 处收敛，Cesium/OL 行数保持 2308/1004；双端 typecheck、前端 156/1091、backend forecast 27/27。**批 5 整链**：`sh .husky/pre-push` 15/15 exit 0，前端 156/1091、后端 565+82、guard 32/32、mutation 33/33（`.local/pre-push-stage3-batch5.log`）。**批 6（2026-10-29）**：WorkBuddy 在隔离 worktree 产出 z183 E2E，主窗复核落主树（`4a418e36`）；`npx playwright test e2e/route-task-flow.spec.ts e2e/smoke.spec.ts` ⇒ 6 passed（新 2 + 原 smoke 4）；prettier/lint/no-ephemeral 通过。**批 7**：z182 关闭（`786481d6`），deploy needs 增 e2e，策略测试 6/6、摘除红样 2 failed；用户裁定四组口径见 `.local` 决策档。**批 8**：z177 关闭（`5a838604`），K1 A15 + 禁 enum lint，探针 1 error、全量 lint 0 errors。**批 9（2026-10-30）**：d146 `dfdaaa21`、d150 `a4e1f6f2`、d152 `a24dda50` 逐条落主树；WorkBuddy 证据 119 passed/17 gated、types:check、guard 32/32，三条变异各自红且 md5 还原。**批 10（2026-10-30）**：z172 关闭（`a2316733`），K3 §5.1 九类实体字段字典 + `types/map.ts` ports 来源注释；`prettier --check` 通过、`npm run docs:check` 59 件/矩阵 7 项/KP 314 条 exit 0。
- `knownFailures`：① 公网入口 403（见 `publicEntry`）② `qinzhou-port` / `bridges-city` 不入库 ⇒ 新机部署静默 404（`docs/3dtiles-改造任务表.md` §8.21）③ 3D 剩余三项：`h.head=29.6` 高于岸顶 0.6m、low LOD 水面高约 58m、GLB 生成链不在仓 ④ `flood-precomputed`、`terrain-tiles` 两组 `provenanceStatus=pending` 且不计入退出码 ⑤ `K4:371` 的复现钩子 `git log -1 -- 接力状态.md` 在归档后指到指针笔而非原落盘笔（历史 SHA 仍可在同一路径的 git 历史里查到，但命令不再唯一指向）⑥ `d4117a4f` 标题只声明 env 模板，实际混入 d148（并行会话 staged 被同笔提交）；d148 内容已独立复验，历史未改写，S2 已如实登记。⑦ dev 依赖仍余 5 moderate（低于 critical/high 门槛，CI 报告不阻断）；advisory 更新或依赖升级后须重跑 `npm audit`，overrides 只对当时 advisory 有效。
- `archiveIndex`：历史正文 6 片，清单见下表。**零改写取证**：`cat docs/日志/状态/archive/接力状态-*.md | sha256sum` 期望 `30e5986236309dd2ea6e32be71aa7f4681e1bae4de25e88981c30bb5d4cfacb3`；`| wc -c` 期望 `1023031`（7,827 行）。同名口径与复算说明见归档指针 `docs/日志/状态/接力状态.md`

## archiveIndex（历史正文分片）

| 分片                                            | 覆盖日期           | 字节    |
| ----------------------------------------------- | ------------------ | ------- |
| `archive/接力状态-01-2026-10-02至2026-10-17.md` | 2026-10-02 ~ 10-17 | 199,977 |
| `archive/接力状态-02-2026-10-17至2026-10-18.md` | 2026-10-17 ~ 10-18 | 201,780 |
| `archive/接力状态-03-2026-10-18至2026-10-19.md` | 2026-10-18 ~ 10-19 | 199,418 |
| `archive/接力状态-04-2026-10-19至2026-10-20.md` | 2026-10-19 ~ 10-20 | 194,377 |
| `archive/接力状态-05-2026-10-20至2026-10-26.md` | 2026-10-20 ~ 10-26 | 204,386 |
| `archive/接力状态-06-2026-10-26至2026-10-27.md` | 2026-10-26 ~ 10-27 | 23,093  |

## 复算命令（按需跑，不预存结果）

```bash
git rev-parse --abbrev-ref HEAD; git rev-parse --short HEAD   # branch / head
git status --porcelain                                        # worktree
git log --oneline origin/main..HEAD                           # unpushed
npm run docs:check                                            # 登记表与读写矩阵一致性
npm run guard:v3                                              # 本地门禁全集（含本文件体量判据）
node tools/data-audit/source-registry.mjs                     # 来源登记（pending 现状）
curl.exe -sS --noproxy "*" -I http://beibu-gulf.duckdns.org/   # 公网入口状态
```

## 失效条件

- `publicEntry`：接入路线切换后本行作废，须重跑 `curl` 并按新入口改写。
- `ciStatus` 的 run 号与守卫数：`head` 前移即作废，须重取。
- `knownFailures` ②③：资产入库或生产挂载补齐后作废。
- `openDecisions`：任一项被用户裁定后，结论落到本字段并同步 `nextAction`。
- `archiveIndex`：仅当分片被重切时更新；重切必须重出「拼接 == 原文」的 sha256 与字节数。
