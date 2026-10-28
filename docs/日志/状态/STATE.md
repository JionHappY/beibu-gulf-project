# 接手状态档（STATE）— 唯一滚动状态正本

> **定位**：接管新会话只需读本文件 + `docs/文档地图.md`（索引），不必读 1MB 历史。
> 历史正文已按日期归档到 `docs/日志/状态/archive/`（零改写，见 `archiveIndex`）。
> **写入纪律**：只改字段值 + 同步 `updatedAt`；不追加历史段落（历史进 archive 或台账）。
> `branch` / `head` / `worktree` / `unpushed` 四项**只存命令，不存结果**——结果是过期源。

## 字段（18 个，超出即删）

- `updatedAt`：2026-10-28
- `currentGoal`：三条对外承诺各配一条**会红**判据——能打开（公网 443 返回应用正文）、能接手（本文件在预算内且冷启动可答）、能合法用（来源守卫在 CI 执行且 pending/失实都红）。来源：`.local/AGENT-工单-交付边界-20261027.md` §一
- `currentPhase`：W3（接手状态包）已落地；W2-1（来源守卫接线）已落地但 `pending` 仍不参与退出码；W1（公网入口）/ W2-3（pending 判据）/ W4（资产发布判据）**卡用户拍板**
- `activeTask`：交付边界工单四条线；自行可推进的部分已做完，余项均为待裁
- `nextAction`：① 用户对 `openDecisions` 三项拍板；② 按裁定做 W2-3（`pending` 计入失败）与 W1 接入；③ W4 判据按裁定形状实现
- `branch`：`git rev-parse --abbrev-ref HEAD`
- `head`：`git rev-parse --short HEAD`
- `worktree`：`git status --porcelain`
- `unpushed`：`git log --oneline origin/main..HEAD`
- `ciStatus`：以 GitHub Actions 为准（本字段不手填）。最近一次已核对：run `40474535301`（`da57e376`）全 job success，`test:tools` 990、`guard:v3` 32/32（`docs/日志/状态/archive/接力状态-06-2026-10-26至2026-10-27.md`，2026-10-27 节）
- `deployedImage`：未确认，需读 deploy job 日志：`gh run view <run-id> --log`（无 gh 时用 Actions 页面）
- `publicEntry`：**不可打开**——`http://beibu-gulf.duckdns.org/` 实测 `403 Forbidden` / `Server: Beaver` / 正文 `Non-compliance ICP Filing` ⇒ 阿里云**备案拦截**，不是 nginx/证书问题。复现：`curl.exe -sS --noproxy "*" -I http://beibu-gulf.duckdns.org/`（2026-10-28；本机 `HTTP_PROXY=127.0.0.1:7890`，不带 `--noproxy` 会得到 502）
- `openDecisions`：① W1 接入路线（隧道 / 境外反代 / 迁机 / 备案）② `pending` 是当场红还是 `reviewBy` 到期红 ③ §8.21 的 `qinzhou-port` / `bridges-city` 是否入库（约 +157MB）。三项均**不得由执行方选边**，见工单 §四
- `externalBlockers`：① 阿里云备案主体状态未知（需控制台，无凭据代人查）② 服务器能否出网到 Cloudflare 未验证 ③ `PUBLIC_URL` 未配置 ⇒ CI 公网断言无法落地 ④ E-8：push 前哨被仓库根外来目录 `_traetmp/` 阻断（`docs/日志/状态/外部依赖登记.md` E-8）
- `activeFiles`：`docs/日志/状态/STATE.md`、`docs/日志/状态/接力状态.md`（归档指针）、`docs/日志/状态/archive/*`、`tools/v3-guard/protocol-single-source.mjs`、`tools/data-audit/__tests__/audit-data-wiring.test.mjs`、`docs/宪法/C2-质量不变量与根因守则.md`、`.github/workflows/ci.yml`、`package.json`
- `verificationDebt`：① CI 未含公网入口断言（待 `PUBLIC_URL`）② `audit:data` 已接 CI 但 `pending` 不参与退出码（待裁决②）③ W4 的 `tileset.json` 探活判据未做（待裁决③）④ 干净检出只复跑了快集守卫与两条 CLI（32/32 + exit 0），**单测未在干净检出复跑**：本机无 POSIX `sh`、WSL 的 `/bin/bash` 缺失，且不复用工作树 `node_modules`；同 HEAD 同内容已在主树跑过
- `knownFailures`：① 公网入口 403（见 `publicEntry`）② `qinzhou-port` / `bridges-city` 不入库 ⇒ 新机部署静默 404（`docs/3dtiles-改造任务表.md` §8.21）③ 3D 剩余三项：`h.head=29.6` 高于岸顶 0.6m、low LOD 水面高约 58m、GLB 生成链不在仓 ④ `flood-precomputed`、`terrain-tiles` 两组 `provenanceStatus=pending` 且不计入退出码 ⑤ `K4:371` 的复现钩子 `git log -1 -- 接力状态.md` 在归档后指到指针笔而非原落盘笔（历史 SHA 仍可在同一路径的 git 历史里查到，但命令不再唯一指向）
- `archiveIndex`：见下表

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
