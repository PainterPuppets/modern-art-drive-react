import { useCallback, useEffect, useMemo, useState } from 'react'
import { createContainer } from 'unstated-next'
import {
  UNIPASS_URL,
  CKB_NODE_URL,
  CKB_INDEXER_URL,
  CKB_CHAIN_ID,
} from '../../constants'
import PWCore, { IndexerCollector, Provider } from '@lay2/pw-core'
import UnipassProvider from './UnipassProvider'
import UnipassSigner from './UnipassSigner'
import { useLocalStorage } from '../../hooks/useLocalStorage'

function generateUnipassNewUrl(
  host: string,
  action: string,
  params: { [key: string]: string }
): string {
  const urlObj = new URL(`${host}/${action.toLowerCase()}`)
  for (const key of Object.keys(params)) {
    urlObj.searchParams.set(key, params[key])
  }
  return urlObj.href
}

export function toHex(str: string): string {
  let result = ''
  for (let i = 0; i < str.length; i++) {
    result += str.charCodeAt(i).toString(16)
  }
  return result
}

function generateSuccessUrlArgs(args: any): string {
  return encodeURIComponent(
    btoa(unescape(encodeURIComponent(JSON.stringify(args))))
  )
}

function parseSuccessUrlArgs(argsStr: string): any {
  return JSON.parse(
    decodeURIComponent(escape(atob(decodeURIComponent(argsStr))))
  )
}

function generateSuccessUrl(action: string, args: any = []): string {
  return `${window.location.origin}/redirect/${action}_${generateSuccessUrlArgs(
    args
  )}`
}

export function parseSuccessUrl(param: string): {
  action: string
  args: any
} {
  const p = param.split('_')
  return {
    action: p[0],
    args: parseSuccessUrlArgs(p[1]),
  }
}

export interface useUnipassProps {
  address: string | null
  maskedAddress: string | null
  provider: Provider | null
  login: () => void
  parseLoginData: (data: unipassLoginData) => Promise<void>
  parseSignData: (data: unipassSignData, args: any) => Promise<void>
  sign: (message: string, label: string, args: any) => Promise<void>
  waitingSign: WaitingSign | null
  setWaitingSign: (waitingSign: WaitingSign | null) => void
  signout: () => void
  signTx: (raw: any) => Promise<any>
}

export interface unipassLoginData {
  email: string
  pubkey: string
}

export interface unipassSignData {
  pubkey: string
  sig: string
}

export interface WaitingSign {
  data: unipassSignData
  args: any
}

const CKBEnv = {
  NODE_URL: CKB_NODE_URL,
  INDEXER_URL: CKB_INDEXER_URL,
  CHAIN_ID: CKB_CHAIN_ID,
}

function useUnipass(): useUnipassProps {
  const [address, setAddress] = useState<string | null>(null)
  const [provider, setProvider] = useState<Provider | null>(null)
  const [limitTime, setLimitTime] = useLocalStorage<string>('mad_limit', '0')
  const [pubkey, setPubkey] = useLocalStorage<string>('mad_pubkey', '')
  const [email, setEmail] = useLocalStorage<string>('mad_email', '')
  const [waitingSign, setWaitingSign] = useState<WaitingSign | null>(null)

  const maskedAddress = useMemo((): string | null => {
    if (address === null) return null
    return `${address.slice(0, 5)}...${address.slice(-3)}`
  }, [address])

  const login = useCallback(() => {
    const successUrl = generateSuccessUrl('login')
    const url = generateUnipassNewUrl(UNIPASS_URL, 'login', {
      success_url: successUrl,
    })
    window.location.replace(url)
  }, [])

  const signout = useCallback(() => {
    setAddress(null)
    setProvider(null)
    setLimitTime('0')
    setPubkey('')
  }, [setAddress, setProvider, setLimitTime, setPubkey])

  const updateUserInfo = useCallback(
    async (email: string, pubkey: string) => {
      if (!email || !pubkey) return
      PWCore.chainId = parseInt(CKBEnv.CHAIN_ID)
      await new PWCore(CKBEnv.NODE_URL).init(
        new UnipassProvider(email, pubkey),
        new IndexerCollector(CKBEnv.INDEXER_URL),
        parseInt(CKBEnv.CHAIN_ID)
      )
      setEmail(email)
      setPubkey(pubkey)
      setProvider(PWCore.provider)
      setAddress(PWCore.provider.address.addressString)
    },
    [setEmail, setPubkey, setProvider, setAddress]
  )

  const parseLoginData = useCallback(
    async (data: unipassLoginData) => {
      console.log(data.pubkey)
      await updateUserInfo(data.email, data.pubkey)
      setLimitTime(`${new Date().getTime() + 7 * 24 * 3600 * 1000}`)
    },
    [updateUserInfo, setLimitTime]
  )

  const parseSignData = useCallback(
    async (data: unipassSignData, args: any = []) => {
      setWaitingSign({
        data,
        args,
      })
    },
    [setWaitingSign]
  )

  const sign = useCallback(
    async (message: string, label: string, args: any = []) => {
      if (!pubkey) return
      // const messageHash = toHex(message)
      console.log('sign:')
      console.log(message)
      // console.log('get:')
      // console.log(messageHash)
      const successUrl = generateSuccessUrl('sign', { label, args })
      const url = generateUnipassNewUrl(UNIPASS_URL, 'sign', {
        success_url: successUrl,
        pubkey,
        message,
      })
      window.location.replace(url)
    },
    [pubkey]
  )

  const signTx = useCallback(async (raw: any) => {
    const signer = new UnipassSigner()
    const [signedTx] = await signer.toMessages(raw)
    return signedTx.message as any
  }, [])

  useEffect((): void => {
    // 尝试登录
    if (new Date(parseInt(limitTime)) > new Date()) {
      updateUserInfo(email, pubkey).catch((e) => console.log(e))
    }
  }, [])

  return {
    address,
    maskedAddress,
    provider,
    login,
    parseLoginData,
    parseSignData,
    waitingSign,
    setWaitingSign,
    sign,
    signout,
    signTx,
  }
}

const Unipass = createContainer(useUnipass)

export default Unipass
