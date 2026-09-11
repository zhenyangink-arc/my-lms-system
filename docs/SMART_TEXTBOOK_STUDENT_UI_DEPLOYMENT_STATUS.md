# 学生界面部署与提交状态

用户已授权部署并提交。部署前只读核验发现当前服务与此前候选操作单不一致：

- PM2 当前没有 `uply-first-enable` 条目；`uply-dev` 正在主开发目录运行。
- Tailscale HTTPS 8443 仍代理到 `127.0.0.1:3000`，该端口已有 Next 进程监听。
- 候选启动器仍指向 `/home/yangzhen/releases/uply-first-enable-20260910/source`，生产 `next start` 也使用 3000。

因此本轮没有停止现有服务、覆盖候选源码、执行真实配置构建或改变代理。需要确认是否以已验收生产候选替换当前 `uply-dev` 对应的 3000 服务，再执行维护切换。不能将“提交”当成“部署完成”。

提交范围仅为 UI 累计 patch、整合/视觉报告、进度说明和 16 张隔离截图；主工作区其余业务修改保留未提交。源码变更保存在累计 patch 内，而非覆盖正在运行的开发树。补丁基于候选 source，应用前需再核对候选差异。

验收：全仓 1204/1204，隔离构建通过。未执行数据库迁移、对象存储变更、真实账号操作或新 Runtime 扩围。

## 授权后执行结果

用户明确允许暂停 `uply-dev` 并由生产候选接管 3000/8443 后，已执行：

- 将候选与隔离副本重新生成的差异逐字节比对累计补丁，SHA256 `d5a9198841fe048703bfaa12a20f81eea9c7bbeb26f4f0dd4bf762c363c26e61` 完全一致，无漂移。
- 37 个变更文件的原件及原 `.next` 保存在 `/home/yangzhen/releases/uply-first-enable-20260910/ui-deploy-im0YYZ/`（目录 700）。没有覆盖主开发目录，没有删除旧构建。
- 复用候选外 600 权限配置，经目标/生产模式/必需配置检查，直接执行 `next build --webpack` 成功；没有触发 npm prebuild，没有向测试进程注入真实凭据。构建日志受限保存，未输出配置值。
- 停止已核实的 `uply-dev`，启动 `uply-first-enable`，启动器 `/home/yangzhen/.config/uply-first-enable-20260910/start.mjs`，运行 cwd 为既有 release/source。build ID `_be4iVn8oYpP0ZJQ178aH`。
- 启停前后比对其余 PM2 服务 pid/status 均不变。8443 代理不改，443/4000 和其他应用不动。
- HTTP 3000 与 HTTPS 8443 首页均 200，分别抽查三份静态资源均 200。发布入口保持关闭（404）。误探不存在的 `/api/digital-textbook/runtime/learning` 的 404 不计权限验收。
- 保留原 Runtime/Recording 配置与单账号 cohort，不新增范围、不修改 proof/数据库/pointer。没有执行 PM2 全量 save，以免转储其他服务环境。

这些结果证明部署、启动与基础健康，不代表 chen001 已完成真实学习、录音和媒体 E2E。需要用户正常登录原 8443 入口确认第一章，不复制 Cookie/Token，不冒用账号。若出现功能异常，先保留记录定位，不盲目降级判题或恢复不兼容服务。
