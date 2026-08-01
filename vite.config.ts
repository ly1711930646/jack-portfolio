import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

// 数据持久化：把后台内容存到 public/data/content.json（与构建产物同源）。
// dev server 通过 /api/content 接口读写该文件；该文件也会被原样拷贝到 dist/，
// 因此在纯静态托管（GitHub Pages）上可通过 /data/content.json 读取，后台改动不会丢失。
const DATA_FILE = path.resolve(process.cwd(), 'public', 'data', 'content.json')

const contentFileStorage = {
  name: 'content-file-storage',
  configureServer(server: any) {
    server.middlewares.use('/api/content', (req: any, res: any) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

      if (req.method === 'OPTIONS') {
        res.statusCode = 204
        res.end()
        return
      }

      if (req.method === 'GET') {
        try {
          if (!fs.existsSync(DATA_FILE)) {
            fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
            fs.writeFileSync(DATA_FILE, '{}')
          }
          const data = fs.readFileSync(DATA_FILE, 'utf-8')
          res.setHeader('Content-Type', 'application/json')
          res.end(data)
        } catch (e) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: String(e) }))
        }
        return
      }

      if (req.method === 'POST' || req.method === 'PUT') {
        let body = ''
        req.on('data', (chunk: Buffer) => (body += chunk))
        req.on('end', () => {
          try {
            JSON.parse(body) // 校验合法性
            fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
            fs.writeFileSync(DATA_FILE, body)
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch (e) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: String(e) }))
          }
        })
        return
      }

      res.statusCode = 405
      res.end('Method Not Allowed')
    })
  },
}

export default defineConfig({
  // 生产环境部署到 GitHub Pages 的子路径 /jack-portfolio/，必须用绝对 base，
  // 否则 /admin 等子路由经 404.html(SPA 兜底) 回退时，相对资源会解析成
  // /jack-portfolio/admin/assets/... 而 404（空白页）。
  // 开发环境用 '/'，本地直接 http://localhost:5173 访问。
  base: process.env.NODE_ENV === 'production' ? '/jack-portfolio/' : '/',
  plugins: [contentFileStorage],
})
