import { Wallet as EthersWallet, utils as ethersUtils } from 'ethers'

export interface RedwoodClient {
    identity?: Identity
    get: ({ stateURI, keypath, raw }: GetParams) => Promise<any>
    subscribe: (params: SubscribeParams) => Promise<UnsubscribeFunc>
    put: (tx: SendTxArgs) => Promise<void>
    storeBlob: (file: string | Blob) => Promise<StoreBlobResponse>
    authorize: () => Promise<void>
    peers: () => Promise<PeersMap>
    rpc?: RPCClient
    close: () => Promise<void>
}

export interface RPCClient {
    rpcFetch: (method: string, params?: {[key: string]: any}) => Promise<any>
    ucan: () => Promise<string>
    subscribe: ({ stateURI, keypath, txs, states }: RPCSubscribeParams) => void
    identities: () => Promise<RPCIdentitiesResponse[]>
    newIdentity: () => Promise<string>
    stateURIsWithData: () => Promise<string[]>
    sendTx: (tx: SendTxArgs) => void
    addPeer: (dialInfo: PeerDialInfo) => void
    staticRelays: () => Promise<string[]>
    addStaticRelay: (dialAddr: string) => void
    removeStaticRelay: (dialAddr: string) => void
    privateTreeMembers: (stateURI: string) => Promise<string[]>
    peers: () => Promise<RPCPeer[]>
}

export interface Transport {
    setUcan: (newUcan: string) => void
    subscribe: (opts: SubscribeParams, onOpen: () => void) => Promise<UnsubscribeFunc>
    get?: ({ stateURI, keypath, raw }: GetParams) => Promise<any>
    put: (tx: SendTxArgs) => Promise<void>
    ack: (txID: string) => Promise<void>
    storeBlob?: (file: string | Blob) => Promise<StoreBlobResponse>
    authorize: (identity: Identity) => Promise<void>
    foundPeers: (peers: PeersMap) => void
    transportName: () => string
    altSvcAddresses: () => string[]
    close: () => Promise<void>
}

export type UnsubscribeFunc = () => void

export interface ResolverFunc {
    (from: string, id: string, parents: string[] | null | undefined, patches: string[]): Object
}

export interface PeersMap {
    [transport: string]: {
        [dialAddr: string]: boolean
    }
}

export interface PeersCallback {
    (peers: PeersMap): void
}

export interface Tx {
    stateURI: string
    id: string
    parents: string[]
    patches: string[]
    from: string
    recipients?: string[]
    attachment?: string | Blob
    sig: string
}

export interface SendTxArgs {
    stateURI: string
    id?: string
    parents?: string[]
    patches: string[]
    from?: string
    recipients?: string[]
    attachment?: string | Blob
    sig?: string
}

export interface Identity {
    peerID: string
    wallet: EthersWallet
    address: string
    signTx: (tx: Tx) => string
    signBytes: (bytes: ethersUtils.BytesLike) => string
}

export interface SubscribeParams {
    stateURI: string
    keypath?: string
    fromTxID?: string
    states?: boolean
    txs?: boolean
    callback: NewStateCallbackWithError
    useWebsocket?: boolean
}

export interface RPCSubscribeParams {
    stateURI: string
    keypath?: string
    states?: boolean
    txs?: boolean
}

export interface NewStateMsg {
    stateURI: string
    tx: Tx
    state: any
    leaves: string[]
}

export interface NewStateCallback {
    (update: NewStateMsg): void
}

export interface NewStateCallbackWithError {
    (err: string | null, update: NewStateMsg): void
}

export interface GetParams {
    stateURI: string
    keypath?: string
    raw?: boolean
}

export interface StoreBlobResponse {
    sha1: string
    sha3: string
}

export interface RPCIdentitiesResponse {
    address: string
    public: boolean
}

export interface PeerDialInfo {
    transportName: string
    dialAddr: string
}

export interface RPCPeer {
    identities:  RPCPeerIdentity[]
    transport:   string
    dialAddr:    string
    stateURIs:   string[]
    lastContact: Date | null
}

export interface RPCPeerIdentity {
    address:             string
    signingPublicKey:    string
    encryptingPublicKey: string
}
