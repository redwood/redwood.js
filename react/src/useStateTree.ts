import { useEffect, useState, useCallback, useContext, useDebugValue } from 'react'
import { get } from 'lodash'
import useRedwood from './useRedwood'

function useStateTree(stateURI: string, keypath?: string) {
    const {
        redwoodClient,
        subscribe,
        stateTrees,
        updatePrivateTreeMembers,
        setState,
    } = useRedwood()

    useEffect(() => {
        ;(async function() {
            if (!redwoodClient || !updatePrivateTreeMembers) {
                return
            }
            // @@TODO: just read from the `.Members` keypath
            if (!!redwoodClient.rpc) {
                const members = await redwoodClient.rpc.privateTreeMembers(stateURI)
                updatePrivateTreeMembers(stateURI, members)
            }
        })()
    }, [redwoodClient, stateURI, updatePrivateTreeMembers, (stateTrees || {})[stateURI] ])

    useEffect(() => {
        const unsubscribePromise = subscribe(stateURI)

        return () => {
            // (async function() {
            //     const unsubscribe = await unsubscribePromise
            //     unsubscribe()
            // })()
        }
    }, [subscribe, stateURI])

    let setStateForStateURI = useCallback((relKeypath: string, value: any) => {
        let absKeypath = !!keypath ? keypath + relKeypath : relKeypath
        return setState(stateURI, absKeypath, value)
    }, [setState, stateURI, keypath])

    let state = !!stateURI ? stateTrees[stateURI] : null

    if (!!keypath) {
        let normalizedKeypath = keypath.split('.').filter(part => !!part && part.trim().length > 0).map(part => part.trim())
        state = get(state, normalizedKeypath)
    }

    return [state, setStateForStateURI]
}

export default useStateTree
