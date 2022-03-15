import * as identity from './identity'
import * as sync9 from './resolver.sync9.browser'
import * as dumb from './resolver.dumb.browser'
import * as utils from './utils'
import httpTransport from './transport.http'
// import * as webrtcTransport from './transport.webrtc'
import rpcTransport from './transport.rpc'
import {
    Transport,
    Identity,
    PeersMap,
    PeersCallback,
    SubscribeParams,
    GetParams,
    Tx,
    SendTxArgs,
    StoreBlobResponse,
    UnsubscribeFunc,
} from './types'

export * from './types'

export default {
    createPeer,

    // submodules
    identity,
    sync9,
    dumb,
    utils,
}

interface CreatePeerOptions {
    httpHost: string
    identity?: Identity
    webrtc?: boolean
    onFoundPeersCallback?: PeersCallback
    rpcEndpoint?: string
}

function createPeer(opts: CreatePeerOptions) {
    const { httpHost, identity, webrtc, onFoundPeersCallback, rpcEndpoint } = opts

    const http = httpTransport({ onFoundPeers, httpHost })
    const transports: Transport[] = [ http ]
    // if (webrtc === true) {
    //     transports.push(webrtcTransport({ onFoundPeers, peerID: identity.peerID }))
    // }

    function setUcan(newUcan: string) {
        for (let tpt of transports) {
            if (tpt.setUcan) {
                return tpt.setUcan(newUcan)
            }
        }
    }

    let knownPeers: PeersMap = {}
    function onFoundPeers(peers: PeersMap) {
        knownPeers = utils.deepmerge(knownPeers, peers)

        transports.forEach(tpt => tpt.foundPeers(knownPeers))

        if (onFoundPeersCallback) {
            onFoundPeersCallback(knownPeers)
        }
    }

    async function peers() {
        return knownPeers
    }

    async function authorize() {
        if (!identity) {
            throw new Error('cannot .authorize() without an identity')
        }
        for (let tpt of transports) {
            if (tpt.authorize) {
                await tpt.authorize(identity)
            }
        }
    }

    const leaves: {
        [stateURI: string]: string[]
    } = {}

    const subscriptions: {
        [stateURI: string]: {
            params: SubscribeParams
            subscribed: boolean
            innerUnsubscribe: UnsubscribeFunc
        }
    } = {}

    setInterval(async () => {
        for (let stateURI of Object.keys(subscriptions)) {
            if (!subscriptions[stateURI].subscribed) {
                subscriptions[stateURI].innerUnsubscribe = await initSubscription(subscriptions[stateURI].params)
            }
        }
    }, 1000)

    async function subscribe(params: SubscribeParams) {
        if (subscriptions[params.stateURI] && subscriptions[params.stateURI].subscribed) {
            return subscriptions[params.stateURI].innerUnsubscribe
        }
        subscriptions[params.stateURI] = { params, subscribed: false, innerUnsubscribe: () => {} }
        return () => {
            subscriptions[params.stateURI].innerUnsubscribe()
            delete subscriptions[params.stateURI]
        }
    }

    async function initSubscription(params: SubscribeParams) {
        let callback = params.callback
        params.callback = (err, update) => {
            if (err) {
                console.error('subscription error:', err)
                subscriptions[params.stateURI].subscribed = false
            }

            leaves[update.stateURI] = leaves[update.stateURI] || {}
            leaves[update.stateURI] = update.leaves

            callback(err, update)
        }

        let unsubscribers = (await Promise.all(
            transports.map(tpt => tpt.subscribe(params, () => { subscriptions[params.stateURI].subscribed = true }))
        )).filter(unsub => !!unsub)
        return () => {
            for (let unsub of unsubscribers) {
                if (unsub) {
                    unsub()
                }
            }
        }
    }

    async function get({ stateURI, keypath, raw }: GetParams) {
        for (let tpt of transports) {
            if (tpt.get) {
                return tpt.get({ stateURI, keypath, raw })
            }
        }
    }

    async function put(tx: SendTxArgs) {
        if (!tx.id) {
            tx.id = utils.randomID()
        }
        if (!tx.parents && !!leaves[tx.stateURI]) {
            tx.parents = [ ...leaves[tx.stateURI] ]
        }
        if (identity) {
            tx.from = identity.address
            tx.sig = identity.signTx(tx as Tx)
        }
        for (let tpt of transports) {
            if (tpt.put) {
                try {
                    await tpt.put(tx)
                } catch (err) {
                    console.error('error PUTting to peer ~>', err)
                }
            }
        }
    }

    async function storeBlob(file: string | Blob) {
        for (let tpt of transports) {
            if (tpt.storeBlob) {
                return tpt.storeBlob(file)
            }
        }
        throw new Error('no transports support storeBlob')
    }

    async function close() {
        for (let tpt of transports) {
            await tpt.close()
        }
    }

    return {
        setUcan,
        identity,
        get,
        subscribe,
        put,
        storeBlob,
        authorize,
        peers,
        rpc: rpcEndpoint ? rpcTransport({ endpoint: rpcEndpoint }) : undefined,
        close,
    }
}

