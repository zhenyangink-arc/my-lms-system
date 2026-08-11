# GOAL

等待用户在 Cezar 中提交总任务。

## Rules

- Claude Manager 负责理解总目标并决定下一步子任务
- Codex Worker 只执行当前 NEXT_TASK
- Claude Reviewer 负责验收 Codex 的实际修改
- 未经人工确认，不允许自动 merge 到 main
- 涉及数据库迁移、认证、权限、生产部署、环境变量、大规模删除时必须暂停并请求人工确认
