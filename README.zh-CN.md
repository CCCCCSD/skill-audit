# skill-audit（中文说明）

> 你的 agent 装了 40 个 skill，真正在用的只有 3 个。找出是哪些——以及剩下 37 个正在让你付多少上下文税。

`skill-audit` 是一个纯本地 CLI：盘点机器上所有 AI agent 安装的 skill，找出重复和过期副本，并读取本地会话日志，统计哪些 skill 真的被触发过、哪些是从未触发的"僵尸"——而僵尸照样在每次请求的 system prompt 里占你的上下文。

**零依赖 · 零联网 · 零遥测 · 不需要 API Key · 无需构建**

## 它回答的五个问题

1. 装了什么（跨 agent 全量清单）
2. 装重复了吗（同名 / 内容 hash 相同）
3. 过期了吗（来源、版本、修改时间）
4. 用没用（实际触发次数、最后触发时间、僵尸榜）
5. 值不值（每个 skill 的描述文本在每次请求中固定消耗的 token 估算）

## 支持的 agent

| Agent | 盘点 | 用量分析 |
| --- | --- | --- |
| ZCode | 项目级 / 用户级 / 插件缓存 | 精确（解析会话 rollout JSONL） |
| Codex CLI | 用户级（含 `.system` 内置） | ≈ 估算（路径提及次数扣除基线） |
| Claude Code | 项目级 / 用户级 / 插件 | 精确（`~/.claude/projects` JSONL） |
| Gemini CLI / OpenCode / Cursor | 目录存在即盘点 | 暂无 |

## 用法

```bash
node bin/cli.js                      # 全量报告（盘点 + 重复 + 用量）
node bin/cli.js --dir ~/my/project   # 指定项目目录
node bin/cli.js --json               # JSON 输出
node bin/cli.js usage                # 只看触发统计
node bin/cli.js --no-usage           # 只盘点，不读日志
```

## 隐私

全部本地运行。会话日志包含你的代码——本工具只原地读取，不复制、不上传、无任何遥测。

## Roadmap

- [ ] `clean`：僵尸 skill 归档 + 卸载（先备份）
- [ ] 触发冲突检测：description 互相遮蔽的 skill
- [ ] TUI / HTML 报告
- [ ] 更多 agent 适配器（欢迎 PR，见 `lib/adapters.js`）

## License

MIT
