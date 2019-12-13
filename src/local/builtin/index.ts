import { RPCHost, Invoker } from '@/shared/rpcbase'
import { _getCliArgs, _getProcessInfo, _getSystemInfo, _endpoints, _updateDNS, _resolveDNS } from './misc'

export class BuiltinHost extends RPCHost {
  private fns: Map<string, (args: any, cfg: any) => any>

  constructor (invoker: Invoker) {
    super(invoker)
    this.fns = new Map()

    this.register('cli_args', _getCliArgs)
    this.register('process', _getProcessInfo)
    this.register('system', _getSystemInfo)
    this.register('endpoints', _endpoints)
    this.register('dns_upd', _updateDNS)
    this.register('dns_res', _resolveDNS)
    this.register('list_builtins', () => [...this.fns.keys()])
  }

  async invoke (method: string, args: any, cfg: any) {
    const fn = this.fns.get(method)
    if (!fn) throw new Error('Method not found')
    return fn(args, cfg)
  }

  register (name: string, fn: (args: any, cfg: any) => any) {
    if (this.fns.has(name)) throw new Error('Duplicate registeration')
    this.fns.set(name, fn.bind(this))
  }
}