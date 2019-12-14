import express from 'express'
import { createProxyServer } from 'http-proxy'
import { extensions } from 'webdav-server/lib/index.v2'
import { json } from 'body-parser'
import { spawn } from 'node-pty'

import { packageJson } from '@/shared/package'
import { cliArgs } from '@/shared/cli'
import { endpoints } from '@/interface/cm'
import { DAVServer } from '@/interface/dav'
import { invoke } from '@/router'
import { logInterfaceExpress } from '@/shared/logger'
import { createConnection } from 'net'

const proxy = createProxyServer()

export const app = express()

app.use(json())

app.get('/', (_req, res) => {
  res.json(packageJson)
})

app.get(`/${cliArgs.device}`, (_req, res) => {
  res.json(true)
})

app.use(extensions.express(`/${cliArgs.device}/dav`, DAVServer))

app.post(`/${cliArgs.device}/rpc`, (req, res) => {
  const { method, args, cfg } = req.body
  if (typeof method !== 'string') return <unknown>res.status(400).send('method')
  if (typeof args !== 'object') return <unknown>res.status(400).send('args')
  if (typeof cfg !== 'object') return <unknown>res.status(400).send('cfg')
  invoke(method, args, cfg)
    .then((result) => res.json(result))
    .catch((err) => res.status(500).json(err.message))
})

app.post(`/${cliArgs.device}/sh`, (req, res) => {
  const shell = req.query.shell || (process.platform === 'win32' ? process.env.ComSpec : '/bin/sh')
  const cp = spawn(shell, [], { cols: 80, rows: 30 })
  req.on('data', (chunk) => { cp.write(chunk) })
  cp.on('data', (data) => { res.write(data) })
  req.on('end', () => { cp.kill() })
  res.on('end', () => { cp.kill() })
  cp.on('exit', (code, signal) => {
    logInterfaceExpress(code, signal)
    res.end(`Terminal exited code: ${code} signal: ${signal}`)
  })
})

app.post(`/${cliArgs.device}/proxy`, (req, res) => {
  const host = req.query.host
  const port = parseInt(req.query.port, 10)
  if (typeof host !== 'string') return <unknown>res.status(400).send('Host must be string')
  if (isNaN(port)) return <unknown>res.status(400).send('Port must be number')
  let connected = false
  const conn = createConnection({ port, host, timeout: 1000 }, () => {
    connected = true
    res.status(200)
    req.pipe(conn)
    conn.pipe(res)
  })
  conn.on('error', (err) => {
    connected || res.status(500).send(err.message)
  })
})

app.use('/:id/:method', (req, res) => {
  if (!endpoints.has(req.params.id)) return <unknown>res.status(400).send('Bad request')
  const ep = endpoints.get(req.params.id)!
  proxy.web(req, res, {
    target: `http://${ep}/${req.params.id}/${req.params.method}`
  }, (err) => {
    res.status(500).send(err.message)
  })
})
