import { get } from 'request-promise-native'

import { invokeRemote } from '@/rpc'
import { logInterfaceCM } from '@/misc/logger'

export const endpoints: Map<string, string> = new Map()
export const lazyTimeouts: Map<string, NodeJS.Timeout> = new Map()

const lazyDelay = 500 // 0.5s

export function updateDeviceLazy (id: string) {
  const timeout = lazyTimeouts.get(id)
  timeout && clearTimeout(timeout)
  lazyTimeouts.set(id, setTimeout(updateDevice, lazyDelay, id))
}

export async function updateDevice (id: string) {
  logInterfaceCM('update', id)
  try {
    const eps = <string[]> await invokeRemote('endpoints', {}, { target: id })
    for (const ep of eps) {
      if (await testConn(ep, id)) {
        endpoints.set(id, ep)
        logInterfaceCM(id, '->', ep)
        return
      }
    }
  } catch (e) {
    endpoints.delete(id)
    logInterfaceCM(id, 'removed')
  }
}

async function testConn (endpoint: string, id: string) {
  try {
    const result = <boolean> await get(`http://${endpoint}/${id}`, { json: true, timeout: 1000 })
    return result
  } catch (e) {
    return false
  }
}
