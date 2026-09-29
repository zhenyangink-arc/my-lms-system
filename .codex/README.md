# Codex GPT-6 Sol Multi-Agent 配置

目标配置：

- Supervisor: GPT-6 Sol / xhigh
- Worker low: GPT-6 Sol / low
- Worker medium: GPT-6 Sol / medium
- Worker high: GPT-6 Sol / high
- Worker xhigh: GPT-6 Sol / xhigh
- max: 不使用

## 安装

将本压缩包中的 `.codex/` 目录复制到项目根目录：

```bash
cd ~/projects/my-lms-system
cp -r /解压路径/.codex .
```

最终结构：

```text
my-lms-system/
├── AGENTS.md
└── .codex/
    ├── config.toml
    └── agents/
        ├── worker-low.toml
        ├── worker-medium.toml
        ├── worker-high.toml
        └── worker-xhigh.toml
```

项目需要被 Codex 标记为 trusted，项目级 `.codex/config.toml` 才会被读取。

建议重新开启一个新的 Codex thread/session，让新的模型与 multi-agent 配置完整生效。
