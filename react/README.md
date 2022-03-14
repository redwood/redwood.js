
# @redwood.dev/react

This package provides React hooks and components for interacting with a Redwood node.

**Table of contents**

- [RedwoodProvider](https://github.com/redwood/redwood.js/tree/master/react#redwoodprovider)
- [useStateTree](https://github.com/redwood/redwood.js/tree/master/react#usestatetree)
- [useRedwood](https://github.com/redwood/redwood.js/tree/master/react#useredwood)

## `RedwoodProvider`

The `RedwoodProvider` component must wrap your application. Under the hood, it instantiates a Redwood client, authenticates with the specified node (over the HTTP interface, the RPC interface, or both, depending on the parameters specified), and manages subscriptions and updates (called transactions) sent by the frontend.

You can view the component here: https://github.com/redwood/redwood.js/blob/master/react/src/RedwoodProvider.tsx


**Props:**

- `httpHost: string`: a URL to a Redwood node's HTTP endpoint
- `rpcEndpoint?: string`: a URL to a Redwood node's insecure RPC endpoint
- `useWebsocket?: boolean`: enable websocket subscriptions (to avoid the 6-connections-per-domain limit imposed by modern browsers)
<!-- - `webrtc?: boolean`: **(currently unused)** enable or disable the WebRTC transport that allows browsers to communicate directly with one another -->
- `identity?: Identity`: if the browser is intended to operate as a "full peer," i.e., to maintain its own identity and sign its own updates/transactions, pass in an identity here. Identities can be created with one of the following helper functions:
    - `Redwood.identity.fromMnemonic(mnemonic: string)`: [https://github.com/redwood/redwood.js/blob/master/client/src/identity.ts#L11](https://github.com/redwood/redwood.js/blob/master/client/src/identity.ts#L11)
    - `Redwood.identity.fromPrivateKey(privateKey: string)`: [https://github.com/redwood/redwood.js/blob/master/client/src/identity.ts#L15](https://github.com/redwood/redwood.js/blob/master/client/src/identity.ts#L15)
    - `Redwood.identity.random()`: [https://github.com/redwood/redwood.js/blob/master/client/src/identity.ts#L22](https://github.com/redwood/redwood.js/blob/master/client/src/identity.ts#L22)

For example, assuming that you've created a new project with `create-react-app`, and your Redwood node is running on the default configuration (specifically, enabled transports and the ports they listen on), your `index.js` should look like this:

```tsx
import React from 'react'
import ReactDOM from 'react-dom'
import { RedwoodProvider } from '@redwood.dev/react'

import App from './App'

ReactDOM.render(
    <RedwoodProvider
        httpHost="http://localhost:8080"
        rpcEndpoint="http://localhost:8081"
        useWebsocket={true}
    >
        <App />
    </RedwoodProvider>
    document.getElementById('root')
)
```

It's highly recommended to specify `useWebsocket={true}` given the 6 connection limit on concurrent long-lived connections imposed by modern browsers.


## `useStateTree`

The `useStateTree` hook offers the same API as React's built-in `useState`, but instead of storing state locally, it fetches and updates state stored on the Redwood node specified in your `RedwoodProvider`.

For example, if you have a state tree called `some-state.com/my-app` that looks like this:

```json
{
    "Merge-Type": {
        "Content-Type": "resolver/dumb"
    },
    "counter": {
        "lastUpdated": 0,
        "currentValue": 0
    }
}
```

Here is an example of a component that uses `useStateTree` to read and write that state:

```tsx
import { useStateTree } from '@redwood.dev/react'

function MyComponent() {
    const [state, setState] = useStateTree('some-state.com/my-app')

    function onClickButton() {
        setState('.counter', {
            lastUpdated: new Date().getTime(),
            currentValue: state.counter.currentValue + 1,
        })
    }

    return (
        <div>
            Current value: {((state || {}).counter || {}).currentValue}
            <button onClick={onClickButton}>Click</button>
        </div>
    )
}
```

It's also possible to have `useStateTree` narrow down to a particular slice of a given state tree by specifying a 2nd argument, a keypath:

```tsx
import { useStateTree } from '@redwood.dev/react'

function MyComponent() {
    const [counter, setCounter] = useStateTree('some-state.com/my-app', '.counter.currentValue')

    function onClickButton() {
        setCounter(null, counter + 1)
    }

    return (
        <div>
            Current value: {counter}
            <button onClick={onClickButton}>Click</button>
        </div>
    )
}
```


## `useRedwood`

The `useRedwood` hook operates at a lower level than `useStateTree`, and provides full access to the Redwood client managed by the `RedwoodProvider`. It also caches a variety of information about the node (particularly if the Insecure RPC endpoint is enabled).

```tsx
function useRedwood(): {
    redwoodClient: null | RedwoodClient
    identity: null | undefined | Identity
    httpHost: string
    useWebsocket: boolean
    nodeIdentities: null | RPCIdentitiesResponse[]
    subscribe: (stateURI: string, keypath?: string) => Promise<UnsubscribeFunc>
    subscribedStateURIs: React.MutableRefObject<{[stateURI: string]: boolean}>
    stateTrees: {[stateURI: string]: any}
    leaves: {[txID: string]: boolean}
    privateTreeMembers: {[stateURI: string]: string[]}
    browserPeers: PeersMap
    nodePeers: RPCPeer[]
    setState: (stateURI: string, keypath: string, value: any) => Promise<void>
}
```

- `redwoodClient`: the Redwood client (see https://github.com/redwood/redwood.js/tree/master/client for more information) 
- `identity`: the identity passed to the `RedwoodProvider`
- `httpHost`: the `httpHost` value passed to the `RedwoodProvider`
- `useWebsocket`: the `useWebsocket` value passed to the `RedwoodProvider`
- `nodeIdentities`: the identities (i.e., signing + encrypting public keys) the Redwood node is configured to use
- `subscribe`: subscribe to a given piece of state (idempotent, may be called multiple times, only one subscription will be open)
- `subscribedStateURIs`: the set of state URIs the Redwood client is currently subscribed to. This may differ from the set of state URIs the Redwood node is subscribed to.
- `stateTrees`: a mapping of state URIs to their currently-known state
- `leaves`: a mapping of state URIs to their current "leaf" transactions (i.e., transactions with no children). You can use this to manually set the `parents` of a new transaction, if desired, although the client will do this for you automatically if the `parents` field is omitted.
- `privateTreeMembers`: a cache of the members of each private (i.e., `*.p2p`) state tree known to the client.
- `browserPeers`: the set of potential peers known to the browser. They have not necessarily been contacted or authenticated. This is simply information the client receives through peer gossiping.
- `nodePeers`: the set of potential peers known to the node. They have not necessarily been contacted or authenticated. This is simply information the node receives through peer gossiping.
- `setState`: the long-form version of the `useStateTree` hook's `setState` function. Sends a transaction updating the given state URI + keypath with `value`.


