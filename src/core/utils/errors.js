/**
 * @namespace ErrorTypes
 */

/**
 * @member ValueErr
 * @memberof ErrorTypes
 * @extends Error
 * @description Used whenever there is a value type error when running the engine
 */
export class ValueErr extends Error {
    constructor(message){
        super(message);
        Object.setPrototypeOf(this, ValueErr.prototype)
    }
}

/**
 * @member NotImplemented
 * @memberof ErrorTypes
 * @extends Error
 * @description Used whenever there is a DOM Exception for not found / not impleemented in the compute
 */
export class NotImplemented extends Error {
    constructor(message){
        super(message)
        Object.setPrototypeOf(this, NotImplemented.prototype)
    }
}

/**
 * @member NotFound
 * @memberof ErrorTypes
 * @extends Error
 * @description Used whenever there is an error raised because of not found file(s)
 */
export class NotFound extends Error {
    constructor(message){
        super(message)
        Object.setPrototypeOf(this, NotFound)
    }
}

