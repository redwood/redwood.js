import { Buffer } from 'buffer'
import * as ethers from 'ethers'
import stringify from 'json-stable-stringify'
import { ResolverFunc, NewStateCallback, NewStateMsg, Tx } from './types'

let genesisTxID = '67656e6573697300000000000000000000000000000000000000000000000000'

let JSON = { stringify }
let keccak256 = ethers.utils.keccak256

let keypath = {
    commonAncestor: function(a: string, b: string) {
        let long = a
        let short = b
        if (long.length < short.length) {
            let temp = long
            long = short
            short = temp
        }
        let lastSeparatorIdx = 0
        for (let i = 0; i < short.length; i++) {
            if (short[i] != long[i]) {
                return short.substr(0, lastSeparatorIdx)
            } else if (short[i] === '/') {
                lastSeparatorIdx = i
            }
        }
        return short
    },
}

export {
    genesisTxID,

    createTxQueue,
    hashTx,
    serializeTx,
    keccak256,
    randomID,
    privateTxRootForRecipients,
    stringToHex,
    randomString,
    hexToUint8Array,
    uint8ArrayToHex,
    deepmerge,
    JSON,
    keypath,
}



function createTxQueue(resolverFn: ResolverFunc, txProcessedCallback: NewStateCallback) {
    let queue: NewStateMsg[] = []
    let haveTxs: { [id: string]: boolean } = {}

    function addTx({ stateURI, tx, state, leaves }: NewStateMsg) {
        queue.push({ stateURI, tx, state, leaves })
        processQueue()
    }

    function processQueue() {
        while (true) {
            let processedIdxs = []
            for (let i = 0; i < queue.length; i++) {
                let { stateURI, tx, state, leaves } = queue[i]
                let missingAParent = false
                if (!!tx && !!tx.parents && tx.parents.length > 0) {
                    for (let p of tx.parents) {
                        if (!haveTxs[p]) {
                            missingAParent = true
                            break
                        }
                    }
                }
                if (!missingAParent) {
                    processedIdxs.unshift(i)
                    processTx({ stateURI, tx, state, leaves })
                }
            }

            if (processedIdxs.length === 0) {
                return
            }

            for (let idx of processedIdxs) {
                queue.splice(idx, 1)
            }

            if (queue.length === 0) {
                return
            }
        }
    }

    function processTx({ stateURI, tx, state, leaves }: NewStateMsg) {
        if (!!tx) {
            const newState = resolverFn(tx.from, tx.id, tx.parents, tx.patches)
            haveTxs[tx.id] = true
            txProcessedCallback({ stateURI, tx, leaves, state: newState })
        } else if (!!state) {
            txProcessedCallback({ stateURI, tx, leaves, state })
        }
    }

    return {
        addTx,
        defaultTxHandler: (err: string | undefined, { stateURI, tx, state, leaves }: NewStateMsg) => {
            if (err) throw new Error(err)
            addTx({ stateURI, tx, state, leaves })
        },
    }
}


function hashTx(tx: Tx) {
    let txHex = serializeTx(tx)
    return ethers.utils.keccak256(Buffer.from(txHex, 'hex')).toString()
}

function serializeTx(tx: Tx) {
    let txHex = ''
    txHex += tx.id
    ;(tx.parents || []).forEach(parent => txHex += parent)
    txHex += stringToHex(tx.stateURI)
    tx.patches.forEach(patch => txHex += stringToHex(patch))
    return txHex
}

function privateTxRootForRecipients(recipients: string[]) {
    return 'private-' + ethers.utils.keccak256(
        Buffer.concat( recipients.sort().map(r => Buffer.from(r, 'hex')) )
    ).toString().substr(2)
}

function randomID() {
    return stringToHex(randomString(32))
}

function stringToHex(s: string) {
    return Buffer.from(s, 'utf8').toString('hex')
}

function randomString(length: number) {
    let result           = ''
    let characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let charactersLength = characters.length
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength))
    }
    return result
}

function hexToUint8Array(hexString: string) {
    let result = hexString.match(/.{1,2}/g)
    if (!result) {
        throw new Error(`could not convert "${hexString}" to Uint8Array`)
    }
    return new Uint8Array(result.map(byte => parseInt(byte, 16)))
}

function uint8ArrayToHex(bytes: Uint8Array) {
    return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '')
}

function isMergeableObject(val: any) {
    let nonNullObject = val && typeof val === 'object'
    return nonNullObject
        && Object.prototype.toString.call(val) !== '[object RegExp]'
        && Object.prototype.toString.call(val) !== '[object Date]'
}

function emptyTarget(val: any) {
    return Array.isArray(val) ? [] : {}
}

interface DeepmergeOpts {
    arrayMerge?: typeof defaultArrayMerge
    clone?: boolean
}

function cloneIfNecessary(value: any, opts?: DeepmergeOpts): any {
    let clone = opts && opts.clone === true
    return (clone && isMergeableObject(value)) ? deepmerge(emptyTarget(value), value, opts) : value
}

function defaultArrayMerge<T>(target: T[], source: T[], opts?: DeepmergeOpts): any {
    let destination = target.slice()
    source.forEach((e, i) => {
        if (typeof destination[i] === 'undefined') {
            destination[i] = cloneIfNecessary(e, opts)
        } else if (isMergeableObject(e)) {
            destination[i] = deepmerge(target[i], e, opts)
        } else if (target.indexOf(e) === -1) {
            destination.push(cloneIfNecessary(e, opts))
        }
    })
    return destination
}

function mergeObject(target: any, source: any, opts?: DeepmergeOpts): any {
    let destination: any = {}
    if (isMergeableObject(target)) {
        Object.keys(target).forEach((key) => {
            destination[key] = cloneIfNecessary(target[key], opts)
        })
    }
    Object.keys(source).forEach((key) => {
        if (!isMergeableObject(source[key]) || !target[key]) {
            destination[key] = cloneIfNecessary(source[key], opts)
        } else {
            destination[key] = deepmerge(target[key], source[key], opts)
        }
    })
    return destination
}

function deepmerge<A, B>(target: A, source: B, opts?: DeepmergeOpts): A & B {
    let array = Array.isArray(source)
    let options = opts || { arrayMerge: defaultArrayMerge }
    let arrayMerge = options.arrayMerge || defaultArrayMerge

    if (array) {
        return Array.isArray(target) ? arrayMerge(target, (source as unknown) as any[], opts) : cloneIfNecessary(source, opts)
    } else {
        return mergeObject(target, source, opts)
    }
}

deepmerge.all = function deepmergeAll(array: any, opts?: DeepmergeOpts): any {
    if (!Array.isArray(array) || array.length < 2) {
        throw new Error('first argument should be an array with at least two elements')
    }

    // we are sure there are at least 2 values, so it is safe to have no initial value
    return array.reduce((prev, next) => {
        return deepmerge(prev, next, opts)
    })
}
