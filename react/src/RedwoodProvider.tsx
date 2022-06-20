import React, { createContext, useCallback, useState, useEffect, useRef } from 'react'
import Redwood, { RedwoodClient, Identity, RPCIdentitiesResponse, PeersMap, RPCPeer, UnsubscribeFunc } from '@redwood.dev/client'

export interface IContext {
    identity: null | undefined | Identity
    nodeIdentities: null | RPCIdentitiesResponse[]
    redwoodClient: null | RedwoodClient
    httpHost: string
    useWebsocket: boolean
    subscribe: (stateURI: string, keypath?: string) => Promise<UnsubscribeFunc>
    subscribedStateURIs: React.MutableRefObject<{[stateURI: string]: boolean}>
    stateTrees: any
    updateStateTree: (stateURI: string, newTree: any, newLeaves: string[]) => void
    leaves: {[txID: string]: boolean}
    browserPeers: PeersMap
    nodePeers: RPCPeer[]
    fetchIdentities: () => void
    fetchRedwoodClient: () => void
    setState: (stateURI: string, keypath: string, value: any) => Promise<void>
}

export const Context = createContext<IContext>({
    identity: null,
    nodeIdentities: null,
    redwoodClient: null,
    httpHost: '',
    useWebsocket: false,
    subscribe: (stateURI: string, keypath?: string) => { return new Promise(() => {}) },
    subscribedStateURIs: { current: {} },
    stateTrees: {},
    updateStateTree: (stateURI: string, newTree: any, newLeaves: string[]) => {},
    leaves: {},
    browserPeers: {},
    nodePeers: [],
    fetchIdentities: () => {},
    fetchRedwoodClient: () => {},
    setState: async (stateURI: string, keypath: string, value: any) => {},
})

function Provider(props: {
    httpHost: string,
    rpcEndpoint?: string,
    useWebsocket?: boolean,
    webrtc?: boolean,
    identity?: Identity,
    children: React.ReactNode,
}) {
    let { httpHost, rpcEndpoint, useWebsocket, identity, webrtc, children } = props

    const [nodeIdentities, setNodeIdentities] = useState<null|RPCIdentitiesResponse[]>(null)
    const [redwoodClient, setRedwoodClient] = useState<null|RedwoodClient>(null)
    const subscribedStateURIs = useRef<{[stateURI: string]: boolean}>({})
    const [stateTrees, setStateTrees] = useState({})
    const [leaves, setLeaves] = useState({})
    const [browserPeers, setBrowserPeers] = useState({})
    const [nodePeers, setNodePeers] = useState<RPCPeer[]>([])
    const [error, setError] = useState(null)

    useEffect(() => {
        ;(async function() {
            subscribedStateURIs.current = {}
            setRedwoodClient(null)
            setNodeIdentities(null)
            setNodePeers([])
            setStateTrees({})
            setLeaves({})
            setBrowserPeers({})
            setError(null)

            if (!httpHost) {
                return
            }

            let client = Redwood.createPeer({
                identity,
                httpHost,
                rpcEndpoint,
                webrtc,
                onFoundPeersCallback: (peers) => { setBrowserPeers(peers) },
            })
            if (!!identity) {
                await client.authorize()
            }
            if (!!rpcEndpoint && !!client.rpc) {
                let ucan = await client.rpc.ucan()
                client.setUcan(ucan)
            }
            setInterval(async () => {
                if (!!client.rpc) {
                    try {
                        let nodeIdentities = await client.rpc.identities()
                        setNodeIdentities(nodeIdentities)
                    } catch (err) { console.error(err) }

                    try {
                        let nodePeers = await client.rpc.peers()
                        setNodePeers(nodePeers)
                    } catch (err) { console.error(err) }
                }
            }, 5000)
            setRedwoodClient(client)
        })()

        return () => {
            if (redwoodClient) {
                redwoodClient.close()
            }
        }
    }, [identity, httpHost, rpcEndpoint, webrtc])

    let updateStateTree = useCallback((stateURI: string, newTree: any, newLeaves: string[]) => {
        setStateTrees(prevState => ({ ...prevState, [stateURI]: newTree }))
        setLeaves(prevLeaves => ({ ...prevLeaves, [stateURI]: newLeaves }))
    }, [setStateTrees, setLeaves])

    let subscribe = useCallback(async (stateURI: string, keypath?: string) => {
        if (!redwoodClient) {
            return () => {}
        } else if (subscribedStateURIs.current[stateURI]) {
            return () => {}
        }
        const unsubscribePromise = redwoodClient.subscribe({
            stateURI,
            keypath: keypath || '/',
            states: true,
            useWebsocket,
            callback: async (err, next) => {
                if (err) {
                    console.error(err)
                    return
                }
                let { stateURI, state, leaves } = next
                updateStateTree(stateURI, state, leaves)
            },
        })

        subscribedStateURIs.current[stateURI] = true

        return () => {
            (async function() {
                const unsubscribe = await unsubscribePromise
                unsubscribe()
                subscribedStateURIs.current[stateURI] = false
            })()
        }
    }, [redwoodClient, useWebsocket, updateStateTree])

    let setState = useCallback(async (stateURI: string, keypath: string, value: any) => {
        if (!redwoodClient) {
            console.error('Warning: setState was called before the Redwood client was initialized')
            return
        }
        if (keypath[0] === '/' || keypath[0] === '.') {
            keypath = keypath.slice(1)
        }
        keypath = keypath.replace('/', '.')
        return redwoodClient.put({
            id: Redwood.utils.randomID(),
            stateURI,
            patches: [
                `.${keypath} = ${Redwood.utils.JSON.stringify(value)}`,
            ],
        })
    }, [redwoodClient])

    return (
      <Context.Provider value={{
          identity,
          nodeIdentities,
          redwoodClient,
          httpHost,
          useWebsocket: !!useWebsocket,
          subscribe,
          subscribedStateURIs,
          setState,
          stateTrees,
          leaves,
          updateStateTree,
          browserPeers,
          nodePeers,
          fetchIdentities: () => {},
          fetchRedwoodClient: () => {},
      }}>
          {children}
      </Context.Provider>
    )
}

export default Provider