# cnbuycha.com Cloudflare 迁移版

这是从旧 EyouCMS/PHP 站点恢复出的 Cloudflare Worker 版本。前台延续旧站的页面结构与商品链接，后台入口仍是 `/yc.php`，可登录后增加、编辑、隐藏和删除产品。

## 已迁移内容

- 3,235 个有效产品
- 11,940 条产品图记录
- 15 个分类
- 原产品 ID、分类路径和 `分类/数字.html` 链接
- 首页、产品列表、搜索、排序、详情页和购买平台链接
- 后台密码登录、CSRF 防护、产品管理与多图上传

旧 PHP、运行缓存、数据库账号、历史备份和混淆脚本均未带入新站。

## 不使用 R2 的存储结构

- `cnbuycha`：主 Worker、前后台和 D1 数据库
- `cnbuycha-media`：12,960 个旧图片静态资源（约 1.7GB）
- 新上传图片：直接存入 D1 的 `uploaded_files` 表，单张限制 1.5MB
- GitHub：只保存程序与数据迁移文件，不保存 1.7GB 旧图片

## 本地验证

```bash
npm ci
npm test
npm run build
npm run db:local
```

受某些容器网络接口限制时，`wrangler dev` 可能无法启动，但集成测试会使用真实 SQLite 执行全部迁移，并覆盖首页、旧产品详情、后台登录、增加产品和上传图片流程。

## Cloudflare 部署顺序

1. 登录 Wrangler：`npx wrangler login`
2. 部署旧图片 Worker：`npx wrangler deploy --config wrangler.media.jsonc`
3. 创建 D1，并把返回的数据库 ID 写入 `wrangler.jsonc`：`npx wrangler d1 create cnbuycha`
4. 导入数据：`npx wrangler d1 migrations apply cnbuycha --remote`
5. 生成后台密码哈希与会话密钥：`node tools/generate-secrets.mjs '你的新密码'`
6. 分别用 `npx wrangler secret put ADMIN_PASSWORD_HASH` 和 `npx wrangler secret put SESSION_SECRET` 保存密钥
7. 部署主 Worker：`npx wrangler deploy`
8. 测试 Worker 地址的首页、分类、商品详情和 `/yc.php`
9. 全部确认后再把 `cnbuycha.com` 与 `www.cnbuycha.com` 绑定到主 Worker

不要把 `.dev.vars`、旧数据库配置或后台明文密码提交到 GitHub。

## 数据重新生成

如果要从另一份 EyouCMS SQL 备份重新迁移：

```bash
node tools/migrate-eyoucms.mjs /path/to/latest.sql migrations
```

脚本只读取公开站点配置、商品、分类和产品图片记录，不会导出旧管理员密码或数据库连接信息。
